const prisma = require('../utils/prisma');

async function requirePassengerNotSuspended(req, res, next) {
  try {
    const userId = req.user?.sub;
    if (!userId) return next();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passengerSuspendedUntil: true },
    });

    if (user?.passengerSuspendedUntil && user.passengerSuspendedUntil > new Date()) {
      return res.status(423).json({
        success: false,
        code: 'PASSENGER_SUSPENDED',
        message: 'บัญชีของคุณถูกระงับการจองชั่วคราว ไม่สามารถสร้างการจองใหม่ได้ในช่วงนี้',
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}

async function requireDriverNotSuspended(req, res, next) {
  try {
    const userId = req.user?.sub;
    if (!userId) return next();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { driverSuspendedUntil: true },
    });

    if (user?.driverSuspendedUntil && user.driverSuspendedUntil > new Date()) {
      return res.status(423).json({
        success: false,
        code: 'DRIVER_SUSPENDED',
        message: 'บัญชีผู้ขับขี่ของคุณถูกระงับชั่วคราว ไม่สามารถสร้าง/แก้ไขเส้นทางได้ในช่วงนี้',
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  requirePassengerNotSuspended,
  requireDriverNotSuspended,
};
