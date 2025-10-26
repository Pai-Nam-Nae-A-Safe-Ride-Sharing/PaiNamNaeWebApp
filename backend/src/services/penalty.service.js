const prisma = require("../utils/prisma");

const DRIVER_CANCEL_LIMIT = 3;
const PASSENGER_CANCEL_LIMIT = 3;
const WINDOW_DAYS = 30;
const SUSPEND_DAYS = 7;

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** ---------- Record Events (idempotent) ---------- */
async function recordDriverPenaltyEvent(driverId, { type, routeId, bookingId } = {}) {
  if (!driverId || !type) return;
  try {
    await prisma.penaltyEvent.create({
      data: { userId: driverId, type, routeId: routeId || null, bookingId: bookingId || null },
    });
  } catch (err) {
    // P2002 = unique constraint (ถือว่าบันทึกไว้แล้ว)
    if (err?.code !== 'P2002') throw err;
  }
}

async function recordPassengerPenaltyEvent(passengerId, { type, routeId, bookingId } = {}) {
  if (!passengerId || !type) return;
  try {
    await prisma.penaltyEvent.create({
      data: { userId: passengerId, type, routeId: routeId || null, bookingId: bookingId || null },
    });
  } catch (err) {
    if (err?.code !== 'P2002') throw err;
  }
}

/** ---------- Check & Apply Suspensions ---------- */
async function checkAndApplyDriverSuspension(driverId) {
  const user = await prisma.user.findUnique({
    where: { id: driverId },
    select: { driverPenaltyResetAt: true }
  });

  const sinceByWindow = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const since = user?.driverPenaltyResetAt && user.driverPenaltyResetAt > sinceByWindow
    ? user.driverPenaltyResetAt
    : sinceByWindow;

  const count = await prisma.penaltyEvent.count({
    where: { userId: driverId, type: 'DRIVER_CONFIRMED_CANCEL', createdAt: { gte: since } },
  });

  if (count >= DRIVER_CANCEL_LIMIT) {
    const until = addDays(new Date(), SUSPEND_DAYS);
    await prisma.user.update({
      where: { id: driverId },
      data: { driverSuspendedUntil: until },
    });
    // แจ้งเตือน (optional)
    try {
      await prisma.notification.create({
        data: {
          userId: driverId,
          type: "SYSTEM",
          title: "ระงับสิทธิ์ผู้ขับขี่ชั่วคราว",
          body: `บัญชีผู้ขับขี่ของคุณถูกระงับ ${SUSPEND_DAYS} วัน เนื่องจากยกเลิกเส้นทางหลังมีการยืนยันแล้ว ${DRIVER_CANCEL_LIMIT} ครั้ง ภายใน ${WINDOW_DAYS} วัน`,
          metadata: { kind: "DRIVER_SUSPENSION", windowDays: WINDOW_DAYS, suspendDays: SUSPEND_DAYS, countedFrom: since },
        },
      });
    } catch (_) {}
  }
}

async function checkAndApplyPassengerSuspension(passengerId) {
  const user = await prisma.user.findUnique({
    where: { id: passengerId },
    select: { passengerPenaltyResetAt: true }
  });

  const sinceByWindow = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const since = user?.passengerPenaltyResetAt && user.passengerPenaltyResetAt > sinceByWindow
    ? user.passengerPenaltyResetAt
    : sinceByWindow;

  const count = await prisma.penaltyEvent.count({
    where: { userId: passengerId, type: 'PASSENGER_CONFIRMED_CANCEL', createdAt: { gte: since } },
  });

  if (count >= PASSENGER_CANCEL_LIMIT) {
    const until = addDays(new Date(), SUSPEND_DAYS);
    await prisma.user.update({
      where: { id: passengerId },
      data: { passengerSuspendedUntil: until },
    });
    // แจ้งเตือน (optional)
    try {
      await prisma.notification.create({
        data: {
          userId: passengerId,
          type: "SYSTEM",
          title: "ระงับสิทธิ์การจองชั่วคราว",
          body: `คุณถูกระงับสิทธิ์การจอง ${SUSPEND_DAYS} วัน เนื่องจากยกเลิกการจองที่ได้รับการยืนยันแล้ว ${PASSENGER_CANCEL_LIMIT} ครั้ง ภายใน ${WINDOW_DAYS} วัน`,
          metadata: { kind: "PASSENGER_SUSPENSION", windowDays: WINDOW_DAYS, suspendDays: SUSPEND_DAYS, countedFrom: since },
        },
      });
    } catch (_) {}
  }
}

/** ---------- Admin helpers (optional) ---------- */
async function resetDriverPenalties(driverId) {
  await prisma.user.update({
    where: { id: driverId },
    data: { driverSuspendedUntil: null, driverPenaltyResetAt: new Date() },
  });
}
async function resetPassengerPenalties(passengerId) {
  await prisma.user.update({
    where: { id: passengerId },
    data: { passengerSuspendedUntil: null, passengerPenaltyResetAt: new Date() },
  });
}

module.exports = {
  recordDriverPenaltyEvent,
  recordPassengerPenaltyEvent,
  checkAndApplyDriverSuspension,
  checkAndApplyPassengerSuspension,
  resetDriverPenalties,
  resetPassengerPenalties,
};
