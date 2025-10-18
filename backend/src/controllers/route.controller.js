const asyncHandler = require("express-async-handler");
const routeService = require("../services/route.service");
const vehicleService = require("../services/vehicle.service");
const ApiError = require("../utils/ApiError");
const verifService = require("../services/driverVerification.service");
const { getDirections } = require("../utils/googleMaps");

const getAllRoutes = asyncHandler(async (req, res) => {
  const routes = await routeService.getAllRoutes();
  res.status(200).json({
    success: true,
    message: "Routes retrieved successfully",
    data: routes,
  });
});

const listRoutes = asyncHandler(async (req, res) => {
  const result = await routeService.searchRoutes(req.query);
  res.status(200).json({
    success: true,
    message: "Routes retrieved successfully",
    ...result,
  });
});

const adminListRoutes = asyncHandler(async (req, res) => {
  const result = await routeService.searchRoutes(req.query);
  res.status(200).json({
    success: true,
    message: "Routes (admin) retrieved successfully",
    ...result,
  });
});

const getRouteById = asyncHandler(async (req, res) => {
  const route = await routeService.getRouteById(req.params.id);
  if (!route) {
    throw new ApiError(404, "Route not found");
  }
  res.status(200).json({
    success: true,
    message: "Route retrieved successfully",
    data: route,
  });
});

const getMyRoutes = asyncHandler(async (req, res) => {
  const driverId = req.user.sub
  const list = await routeService.getMyRoutes(driverId)
  res.status(200).json({
    success: true,
    message: "Route retrieved successfully",
    data: list
  })
})

const adminGetRoutesByDriver = asyncHandler(async (req, res) => {
  const { driverId } = req.params
  const list = await routeService.getMyRoutes(driverId)
  res.status(200).json({
    success: true,
    message: "retrieved successfully",
    data: list
  })
})

const createRoute = asyncHandler(async (req, res) => {
  const driverId = req.user.sub;
  const { vehicleId, optimizeWaypoints, ...routeFields } = req.body;

  await vehicleService.getVehicleById(vehicleId, driverId);

  const payload = {
    ...routeFields,
    driverId,
    vehicleId,
    departureTime: new Date(routeFields.departureTime),
  };

  // ===== Enrich จาก Google Directions =====
  const directions = await getDirections({
    origin: payload.startLocation,
    destination: payload.endLocation,
    waypoints: routeFields.waypoints || [],
    optimizeWaypoints,
    alternatives: false,
    departureTime: payload.departureTime.toISOString()
  });

  const primary = directions.routes?.[0];
  if (primary) {
    const legs = primary.legs || [];
    const sumMeters = legs.reduce((a, l) => a + (l.distance?.value || 0), 0);
    const sumSeconds = legs.reduce((a, l) => a + (l.duration?.value || 0), 0);

    payload.routeSummary = primary.summary || `${legs[0]?.start_address} → ${legs.at(-1)?.end_address}`;
    payload.distance = legs.length ? legs.map(l => l.distance?.text).filter(Boolean).join(' + ') : null; // หรือ format เอง
    payload.duration = legs.length ? legs.map(l => l.duration?.text).filter(Boolean).join(' + ') : null;
    payload.distanceMeters = sumMeters;
    payload.durationSeconds = sumSeconds;
    payload.routePolyline = primary.overview_polyline?.points || null;

    // รวม steps ทั้งหมด
    payload.steps = legs.flatMap(leg =>
      (leg.steps || []).map(s => ({
        html_instructions: s.html_instructions,
        distance: s.distance?.text,
        duration: s.duration?.text,
        start_location: s.start_location,
        end_location: s.end_location,
        travel_mode: s.travel_mode,
        maneuver: s.maneuver || null,
      }))
    );

    // เก็บ waypoints ที่ “ร้องขอ” และผลลำดับที่ Google จัดให้
    payload.waypoints = {
      requested: routeFields.waypoints || [],
      optimizedOrder: primary.waypoint_order || [],
      used: routeFields.waypoints ? (routeFields.waypoints.map((w, i) => w)) : [],
      optimize: Boolean(optimizeWaypoints)
    };

    payload.landmarks = { overview_polyline: payload.routePolyline };
  }

  const newRoute = await routeService.createRoute(payload);
  res.status(201).json({
    success: true,
    message: "Route created successfully",
    data: newRoute
  });
});

const updateRoute = asyncHandler(async (req, res) => {
  const driverId = req.user.sub;
  const { id } = req.params;
  const { vehicleId, optimizeWaypoints, ...routeFields } = req.body;

  const existing = await routeService.getRouteById(id);
  if (!existing) throw new ApiError(404, "Route not found");
  if (existing.driverId !== driverId) throw new ApiError(403, "Forbidden");

  if (existing.status === 'CANCELLED') {
    throw new ApiError(400, "ไม่สามารถแก้ไขเส้นทางที่ถูกยกเลิกได้");
  }

  // await vehicleService.getVehicleById(vehicleId, driverId);
  let newVehicleId = existing.vehicleId;
  if (vehicleId) {
    await vehicleService.getVehicleById(vehicleId, driverId);
    newVehicleId = vehicleId;
  }
  const payload = {
    ...routeFields,
    vehicleId: newVehicleId,
    ...(routeFields.departureTime && {
      departureTime: new Date(routeFields.departureTime),
    }),
  };

  // ===== รีเฟรชข้อมูล Directions เฉพาะเมื่อจุดสำคัญเปลี่ยน =====
  const startChanged = routeFields.startLocation !== undefined &&
    JSON.stringify(routeFields.startLocation) !== JSON.stringify(existing.startLocation);
  const endChanged = routeFields.endLocation !== undefined &&
    JSON.stringify(routeFields.endLocation) !== JSON.stringify(existing.endLocation);
  const timeChanged = routeFields.departureTime !== undefined;
  const wpsChanged = routeFields.waypoints !== undefined &&
    JSON.stringify(routeFields.waypoints) !== JSON.stringify(
      Array.isArray(existing.waypoints) ? existing.waypoints : existing.waypoints?.requested || []
    );
  const optimizeChanged = routeFields.optimizeWaypoints !== undefined &&
    optimizeWaypoints !== (existing.waypoints?.optimize ?? false)


  if (startChanged || endChanged || timeChanged || wpsChanged || optimizeChanged) {
    const origin = payload.startLocation ?? existing.startLocation;
    const destination = payload.endLocation ?? existing.endLocation;
    const depTime = (payload.departureTime ?? existing.departureTime).toISOString();
    const currentWps =
      routeFields.waypoints !== undefined
        ? (routeFields.waypoints || [])
        : (Array.isArray(existing.waypoints) ? existing.waypoints : existing.waypoints?.requested || []);
    const currentOptimize =
      optimizeWaypoints !== undefined
        ? optimizeWaypoints
        : (existing.waypoints?.optimize ?? false);

    const directions = await getDirections({
      origin,
      destination,
      waypoints: currentWps,
      optimizeWaypoints: currentOptimize,
      alternatives: false,
      departureTime: depTime
    });

    const primary = directions.routes?.[0];
    if (primary) {
      const legs = primary.legs || [];
      const sumMeters = legs.reduce((a, l) => a + (l.distance?.value || 0), 0);
      const sumSeconds = legs.reduce((a, l) => a + (l.duration?.value || 0), 0);

      payload.routeSummary = primary.summary || `${legs[0]?.start_address} → ${legs.at(-1)?.end_address}`;
      payload.distance = legs.length ? legs.map(l => l.distance?.text).filter(Boolean).join(' + ') : null;
      payload.duration = legs.length ? legs.map(l => l.duration?.text).filter(Boolean).join(' + ') : null;
      payload.distanceMeters = sumMeters;
      payload.durationSeconds = sumSeconds;
      payload.routePolyline = primary.overview_polyline?.points || null;

      payload.steps = legs.flatMap(leg =>
        (leg.steps || []).map(s => ({
          html_instructions: s.html_instructions,
          distance: s.distance?.text,
          duration: s.duration?.text,
          start_location: s.start_location,
          end_location: s.end_location,
          travel_mode: s.travel_mode,
          maneuver: s.maneuver || null,
        }))
      );
      payload.waypoints = {
        requested: currentWps,
        optimizedOrder: primary.waypoint_order || [],
        used: currentWps.map(w => w),
        optimize: Boolean(currentOptimize)
      };
      payload.landmarks = { overview_polyline: payload.routePolyline };
    }
  }

  const updated = await routeService.updateRoute(id, payload);
  res.status(200).json({
    success: true,
    message: "Route updated successfully",
    data: updated
  });
});

const deleteRoute = asyncHandler(async (req, res) => {
  const driverId = req.user.sub;
  const { id } = req.params;

  const existing = await routeService.getRouteById(id);
  if (!existing) throw new ApiError(404, "Route not found");
  if (existing.driverId !== driverId) throw new ApiError(403, "Forbidden");

  if (existing.status === 'CANCELLED') {
    throw new ApiError(400, "ไม่สามารถลบเส้นทางที่ถูกยกเลิกได้");
  }
  const result = await routeService.deleteRoute(id);
  res.status(200).json({
    success: true,
    message: "Route deleted successfully",
    data: result
  });
});

const adminCreateRoute = asyncHandler(async (req, res) => {
  const { driverId, vehicleId, optimizeWaypoints, ...routeFields } = req.body;

  const approved = await verifService.canCreateRoutes(driverId);
  if (!approved) {
    throw new ApiError(400, "ไม่สามารถสร้างเส้นทางให้ไดรเวอร์ที่ยังไม่ได้ยืนยันตัวตน (ต้องมีรายการยืนยันและสถานะไม่เป็น REJECTED)");
  }

  await vehicleService.getVehicleById(vehicleId, driverId);

  const payload = {
    ...routeFields,
    driverId,
    vehicleId,
    departureTime: new Date(routeFields.departureTime),
  };

  // Enrich แบบเดียวกับ createRoute (รองรับ waypoints/optimizeWaypoints)
  const directions = await getDirections({
    origin: payload.startLocation,
    destination: payload.endLocation,
    waypoints: routeFields.waypoints || [],
    optimizeWaypoints,
    alternatives: false,
    departureTime: payload.departureTime.toISOString()
  });
  const primary = directions.routes?.[0];
  if (primary) {
    const legs = primary.legs || [];
    const sumMeters = legs.reduce((a, l) => a + (l.distance?.value || 0), 0);
    const sumSeconds = legs.reduce((a, l) => a + (l.duration?.value || 0), 0);

    payload.routeSummary = primary.summary || `${legs[0]?.start_address} → ${legs.at(-1)?.end_address}`;
    payload.distance = legs.length ? legs.map(l => l.distance?.text).filter(Boolean).join(' + ') : null;
    payload.duration = legs.length ? legs.map(l => l.duration?.text).filter(Boolean).join(' + ') : null;
    payload.distanceMeters = sumMeters;
    payload.durationSeconds = sumSeconds;
    payload.routePolyline = primary.overview_polyline?.points || null;

    // รวม steps ทุก leg
    payload.steps = legs.flatMap(leg =>
      (leg.steps || []).map(s => ({
        html_instructions: s.html_instructions,
        distance: s.distance?.text,
        duration: s.duration?.text,
        start_location: s.start_location,
        end_location: s.end_location,
        travel_mode: s.travel_mode,
        maneuver: s.maneuver || null,
      }))
    );

    payload.waypoints = {
      requested: routeFields.waypoints || [],
      optimizedOrder: primary.waypoint_order || [],
      used: routeFields.waypoints ? routeFields.waypoints.map(w => w) : [],
      optimize: Boolean(optimizeWaypoints)
    };
    payload.landmarks = { overview_polyline: payload.routePolyline };
  }

  const newRoute = await routeService.createRoute(payload);
  res.status(201).json({
    success: true,
    message: "Route (by admin) created successfully",
    data: newRoute,
  });
});

const adminUpdateRoute = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { driverId, vehicleId, optimizeWaypoints, ...routeFields } = req.body;

  const existing = await routeService.getRouteById(id);
  if (!existing) throw new ApiError(404, "Route not found");

  let newDriverId = existing.driverId;
  let newVehicleId = existing.vehicleId;

  if (driverId) {
    const approved = await verifService.canCreateRoutes(driverId);
    if (!approved) {
      throw new ApiError(400, "ไม่สามารถสร้างเส้นทางให้ไดรเวอร์ที่ยังไม่ได้ยืนยันตัวตน (ต้องมีรายการยืนยันและสถานะไม่เป็น REJECTED)");
    }
    newDriverId = driverId;
  }

  if (vehicleId) {
    const ownerToCheck = driverId ? driverId : newDriverId;
    await vehicleService.getVehicleById(vehicleId, ownerToCheck);
    newVehicleId = vehicleId;
  }

  const payload = {
    ...routeFields,
    driverId: newDriverId,
    vehicleId: newVehicleId,
    ...(routeFields.departureTime && {
      departureTime: new Date(routeFields.departureTime),
    }),
  };

  // ===== รีคอมพิวต์ Directions ถ้า origin/destination/เวลาออกเดินทาง เปลี่ยน =====
  const startChanged = routeFields.startLocation !== undefined &&
    JSON.stringify(routeFields.startLocation) !== JSON.stringify(existing.startLocation);
  const endChanged = routeFields.endLocation !== undefined &&
    JSON.stringify(routeFields.endLocation) !== JSON.stringify(existing.endLocation);
  const timeChanged = routeFields.departureTime !== undefined;
  const wpsChanged = routeFields.waypoints !== undefined &&
    JSON.stringify(routeFields.waypoints) !== JSON.stringify(
      Array.isArray(existing.waypoints) ? existing.waypoints : existing.waypoints?.requested || []
    );
  const optimizeChanged = routeFields.optimizeWaypoints !== undefined &&
    optimizeWaypoints !== (existing.waypoints?.optimize ?? false)

  if (startChanged || endChanged || timeChanged || wpsChanged || optimizeChanged) {
    const origin = payload.startLocation ?? existing.startLocation;
    const destination = payload.endLocation ?? existing.endLocation;
    const depTime = (payload.departureTime ?? existing.departureTime).toISOString();

    const currentWps =
      routeFields.waypoints !== undefined
        ? (routeFields.waypoints || [])
        : (Array.isArray(existing.waypoints) ? existing.waypoints : existing.waypoints?.requested || []);
    const currentOptimize =
      optimizeWaypoints !== undefined
        ? optimizeWaypoints
        : (existing.waypoints?.optimize ?? false);

    const directions = await getDirections({
      origin,
      destination,
      waypoints: currentWps,
      optimizeWaypoints: currentOptimize,
      alternatives: false,
      departureTime: depTime
    });
    const primary = directions.routes?.[0];
    if (primary) {
      const legs = primary.legs || [];
      const sumMeters = legs.reduce((a, l) => a + (l.distance?.value || 0), 0);
      const sumSeconds = legs.reduce((a, l) => a + (l.duration?.value || 0), 0);

      payload.routeSummary = primary.summary || `${legs[0]?.start_address} → ${legs.at(-1)?.end_address}`;
      payload.distance = legs.length ? legs.map(l => l.distance?.text).filter(Boolean).join(' + ') : null;
      payload.duration = legs.length ? legs.map(l => l.duration?.text).filter(Boolean).join(' + ') : null;
      payload.distanceMeters = sumMeters;
      payload.durationSeconds = sumSeconds;
      payload.routePolyline = primary.overview_polyline?.points || null;

      payload.steps = legs.flatMap(leg =>
        (leg.steps || []).map(s => ({
          html_instructions: s.html_instructions,
          distance: s.distance?.text,
          duration: s.duration?.text,
          start_location: s.start_location,
          end_location: s.end_location,
          travel_mode: s.travel_mode,
          maneuver: s.maneuver || null,
        }))
      );
      payload.waypoints = {
        requested: currentWps,
        optimizedOrder: primary.waypoint_order || [],
        used: currentWps.map(w => w),
        optimize: Boolean(currentOptimize)
      };
      payload.landmarks = { overview_polyline: payload.routePolyline };
    }
  }

  const updated = await routeService.updateRoute(id, payload);
  res.status(200).json({
    success: true,
    message: "Route (by admin) updated successfully",
    data: updated,
  });
});

const adminDeleteRoute = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await routeService.getRouteById(id);
  if (!existing) throw new ApiError(404, "Route not found");

  const result = await routeService.deleteRoute(id);
  res.status(200).json({
    success: true,
    message: "Route (by admin) deleted successfully",
    data: result,
  });
});

const cancelRoute = asyncHandler(async (req, res) => {
  const driverId = req.user.sub;
  const { id } = req.params;
  const { reason } = req.body;

  const result = await routeService.cancelRoute(id, driverId, { reason });
  res.status(200).json({
    success: true,
    message: "Route cancelled successfully",
    data: result
  });
});

module.exports = {
  getAllRoutes,
  listRoutes,
  adminListRoutes,
  getRouteById,
  getMyRoutes,
  createRoute,
  updateRoute,
  deleteRoute,
  adminCreateRoute,
  adminUpdateRoute,
  adminDeleteRoute,
  adminGetRoutesByDriver,
  cancelRoute,
};
