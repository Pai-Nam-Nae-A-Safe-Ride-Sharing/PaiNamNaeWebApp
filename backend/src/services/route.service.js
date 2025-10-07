const prisma = require('../utils/prisma');
const { Prisma } = require('@prisma/client');

const baseInclude = {
  driver: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      gender: true,
      profilePicture: true,
      isVerified: true
    }
  },
  vehicle: {
    select: {
      vehicleModel: true,
      vehicleType: true,
      photos: true,
      amenities: true
    }
  }
};

const getAllRoutes = async () => {
  return prisma.route.findMany({
    include: baseInclude,
    orderBy: { createdAt: 'desc' }
  });
};

const searchRoutes = async (opts) => {
  const { startNearLat, startNearLng, endNearLat, endNearLng } = opts || {};
  const hasStart = typeof startNearLat === 'number' && typeof startNearLng === 'number';
  const hasEnd = typeof endNearLat === 'number' && typeof endNearLng === 'number';

  if (hasStart || hasEnd) {
    return searchRoutesByEndpointProximity(opts);
  }

  const {
    page = 1,
    limit = 20,
    q,
    status,
    driverId,
    vehicleId,
    dateFrom,
    dateTo,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = opts || {};

  const where = {
    ...(status && { status }),
    ...(driverId && { driverId }),
    ...(vehicleId && { vehicleId }),
    ...(dateFrom || dateTo ? {
      departureTime: {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      }
    } : {}),
    ...(q ? {
      OR: [
        { routeSummary: { contains: q, mode: 'insensitive' } },
        { conditions: { contains: q, mode: 'insensitive' } },
        // ค้นในความสัมพันธ์ด้วย (ชื่อคนขับ / รุ่นรถ / ประเภท / ทะเบียน ถ้ามีใน model อื่น)
        {
          driver: {
            is: {
              OR: [
                { firstName: { contains: q, mode: 'insensitive' } },
                { lastName: { contains: q, mode: 'insensitive' } },
              ]
            }
          }
        },
        {
          vehicle: {
            is: {
              OR: [
                { vehicleModel: { contains: q, mode: 'insensitive' } },
                { vehicleType: { contains: q, mode: 'insensitive' } },
                // ถ้าต้องการค้นทะเบียน ให้ดึงจาก vehicle.licensePlate (มี @unique)
                { licensePlate: { contains: q, mode: 'insensitive' } },
              ]
            }
          }
        },
      ]
    } : {}),
  };

  const skip = (page - 1) * limit;
  const take = limit;

  const [total, data] = await prisma.$transaction([
    prisma.route.count({ where }),
    prisma.route.findMany({
      where,
      include: baseInclude,
      orderBy: { [sortBy]: sortOrder },
      skip, take,
    })
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    }
  };
};

const searchRoutesByEndpointProximity = async (opts = {}) => {

  const {
    page = 1, limit = 20,
    startNearLat, startNearLng,
    endNearLat, endNearLng,
    radiusMeters = 500,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = opts;

  const offset = (page - 1) * limit;

  // ป้องกัน SQLi: อนุญาตเฉพาะฟิลด์ที่กำหนด
  const allowedSortFields = ['createdAt', 'departureTime', 'pricePerSeat', 'availableSeats'];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const sortDir = (sortOrder || '').toLowerCase() === 'asc' ? 'asc' : 'desc';

  // แปลง undefined -> null เพื่อให้ bind เป็น NULL (ใช้ใน CTE params)
  const sLat = startNearLat ?? null;
  const sLng = startNearLng ?? null;
  const eLat = endNearLat ?? null;
  const eLng = endNearLng ?? null;

  // เลือกเฉพาะ id ก่อน เพื่อทำ include รอบสอง
  // ใช้ Haversine (เป็นเมตร) กับ lat/lng ที่ดึงจาก JSON
  const idsRows = await prisma.$queryRaw(
    Prisma.sql`
      WITH params AS (
        SELECT
          ${sLat}::float AS s_lat,
          ${sLng}::float AS s_lng,
          ${eLat}::float AS e_lat,
          ${eLng}::float AS e_lng,
          ${radiusMeters}::int AS rad
      )
      SELECT r.id
      FROM "Route" r, params p
      WHERE
        -- start within radius (ถ้ามีค่า)
        (
          p.s_lat IS NULL OR p.s_lng IS NULL OR
          6371000 * acos(least(1,
            cos(radians(p.s_lat)) * cos(radians((r."startLocation"->>'lat')::float)) *
            cos(radians((r."startLocation"->>'lng')::float) - radians(p.s_lng)) +
            sin(radians(p.s_lat)) * sin(radians((r."startLocation"->>'lat')::float))
          )) <= p.rad
        )
        AND
        -- end within radius (ถ้ามีค่า)
        (
          p.e_lat IS NULL OR p.e_lng IS NULL OR
          6371000 * acos(least(1,
            cos(radians(p.e_lat)) * cos(radians((r."endLocation"->>'lat')::float)) *
            cos(radians((r."endLocation"->>'lng')::float) - radians(p.e_lng)) +
            sin(radians(p.e_lat)) * sin(radians((r."endLocation"->>'lat')::float))
          )) <= p.rad
        )
      ORDER BY ${Prisma.raw(`r."${sortField}"`)} ${Prisma.raw(sortDir)}
      OFFSET ${offset} LIMIT ${limit};
    `
  );

  const idList = idsRows.map(r => r.id);

  const totalRows = await prisma.$queryRaw(
    Prisma.sql`
      WITH params AS (
        SELECT
          ${sLat}::float AS s_lat,
          ${sLng}::float AS s_lng,
          ${eLat}::float AS e_lat,
          ${eLng}::float AS e_lng,
          ${radiusMeters}::int AS rad
      )
      SELECT count(*)::int AS cnt
      FROM "Route" r, params p
      WHERE
        (p.s_lat IS NULL OR p.s_lng IS NULL OR
          6371000 * acos(least(1,
            cos(radians(p.s_lat)) * cos(radians((r."startLocation"->>'lat')::float)) *
            cos(radians((r."startLocation"->>'lng')::float) - radians(p.s_lng)) +
            sin(radians(p.s_lat)) * sin(radians((r."startLocation"->>'lat')::float))
          )) <= p.rad)
        AND
        (p.e_lat IS NULL OR p.e_lng IS NULL OR
          6371000 * acos(least(1,
            cos(radians(p.e_lat)) * cos(radians((r."endLocation"->>'lat')::float)) *
            cos(radians((r."endLocation"->>'lng')::float) - radians(p.e_lng)) +
            sin(radians(p.e_lat)) * sin(radians((r."endLocation"->>'lat')::float))
          )) <= p.rad);
    `
  );
  const total = totalRows?.[0]?.cnt || 0;

  // ดึงรายละเอียดพร้อม include ตาม id ที่คัดแล้ว
  const data = idList.length
    ? await prisma.route.findMany({
      where: { id: { in: idList } },
      include: {
        driver: { select: { id: true, firstName: true, lastName: true, gender: true, profilePicture: true, isVerified: true } },
        vehicle: { select: { vehicleModel: true, vehicleType: true, photos: true, amenities: true } },
      },
    })
    : [];

  // รักษา order ให้ตรงกับ idList
  const orderMap = new Map(idList.map((id, i) => [id, i]));
  data.sort((a, b) => orderMap.get(a.id) - orderMap.get(b.id));

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getRouteById = async (id) => {
  return prisma.route.findUnique({
    where: { id },
    include: {
      bookings: {
        include: {
          passenger: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePicture: true
            }
          }
        }
      },
      ...baseInclude
    },
  });
};

const getMyRoutes = async (driverId) => {
  return prisma.route.findMany({
    where: {
      driverId
    },
    include: {

      bookings: {
        include: {
          passenger: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
              isVerified: true,
              email: true
            }
          }
        }
      },
      ...baseInclude
    },

    orderBy: { createdAt: 'desc' },
  })
}

const createRoute = async (data) => {
  return prisma.route.create({ data });
};

const updateRoute = async (id, data) => {
  return prisma.route.update({
    where: { id },
    data
  });
};

const deleteRoute = async (id) => {
  await prisma.route.delete({
    where: { id }
  });
  return { id }
};

module.exports = {
  getAllRoutes,
  searchRoutes,
  getRouteById,
  getMyRoutes,
  createRoute,
  updateRoute,
  deleteRoute
};
