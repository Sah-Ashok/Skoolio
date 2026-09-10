import express , {Application} from 'express'
import cors from 'cors';
import authRoutes from './Routes/auth.routes'
import errorHandler from './middlewares/errorHandler.middleware';
import cookieParser from 'cookie-parser';
import schoolRoutes from './Routes/school.routes'
import academicRoutes from './Routes/academic.routes';
import classRoutes from './Routes/class.routes'
import teacherRoutes from './Routes/teacher.routes'
import studentRoutes from './Routes/student.routes';
import feeRoutes from './Routes/fee.routes';
import calendarRoutes from './Routes/calendar.routes';
import attendanceRoutes from './Routes/attendance.routes';
import examRoutes from './Routes/exam.routes';
import expenseRoutes from './Routes/expense.routes';
import subscriptionRoutes from './Routes/subscription.routes';
import platformRoutes from './Routes/platform.routes';
import transportRoutes from './Routes/transport.routes';
import hostelRoutes from './Routes/hostel.routes';
import uploadRoutes from './Routes/upload.routes';
import staffRoutes from './Routes/staff.routes';
import noticeRoutes from './Routes/notice.routes';
import dashboardRoutes from './Routes/dashboard.routes';
import promotionRoutes from './Routes/promotion.routes';
import historyRoutes from './Routes/history.routes';
import onlinePaymentRoutes from './Routes/online_payment.routes';
import feedbackRoutes from './Routes/feedback.routes';
import contactRoutes from './Routes/contact.routes';
import payrollPolicyRoutes    from './Routes/payroll_policy.routes';
import feeBillingPolicyRoutes from './Routes/fee_billing_policy.routes';
import timetableRoutes        from './Routes/timetable.routes';
import securityRoutes         from './Routes/security.routes';
import financeReportRoutes    from './Routes/finance_report.routes';
import { globalHistoryMiddleware } from './middlewares/history.middleware';
import { ipBanAndMaintenanceMiddleware } from './middlewares/ipBan.middleware';
import { globalApiLimiter } from './middlewares/rateLimiter.middleware';
import { activeUserMiddleware } from './middlewares/activeUser.middleware';
import { syncBlockedSchools } from './Service/redis.service';
import logger from './utils/logger';

const app:Application = express();

// Synchronize blocked schools state with Redis on server startup
syncBlockedSchools().catch(() => {});

// P6 fix: CORS origin from env var — set CORS_ORIGIN in .env for staging/production
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true //Allows cookies 
}
))
app.use(express.json());
app.use(cookieParser())

// Edge defense: block banned IPs and enforce platform maintenance
app.use(ipBanAndMaintenanceMiddleware);

// Global API rate limiter (150 req/min per IP)
app.use('/api', globalApiLimiter);

// Live active user heartbeat tracker (fire-and-forget to Redis)
app.use(activeUserMiddleware);

// HTTP Request logging (writes to combined.log asynchronously)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    // Avoid spamming health check pings in logs
    if (req.originalUrl === '/api/health') return;
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Global activity logger — fire-and-forget, never blocks main loop
// Logs all successful POST/PUT/PATCH/DELETE requests for authenticated users
app.use(globalHistoryMiddleware);

app.use('/api/academic-years', academicRoutes);
app.use('/api/auth' , authRoutes);
app.use('/api/school', schoolRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/transport', transportRoutes);
app.use('/api/hostel', hostelRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/notices',   noticeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/promotion', promotionRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/online-payments', onlinePaymentRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/payroll-policy',      payrollPolicyRoutes);
app.use('/api/fee-billing-policy',  feeBillingPolicyRoutes);
app.use('/api/timetable',           timetableRoutes);
app.use('/api/finance/reports',     financeReportRoutes);

app.get('/', (req,res)=>{
    res.json({message: 'SchoolPOS backend server is running '})
})

// Lightweight connectivity check — used by ConnectionBanner on the frontend
// No auth required; just confirms the server is reachable
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.use(errorHandler)
export default app;
