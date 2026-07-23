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
import { globalHistoryMiddleware } from './middlewares/history.middleware';


const app:Application = express();

// P6 fix: CORS origin from env var — set CORS_ORIGIN in .env for staging/production
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true //Allows cookies 
}
))
app.use(express.json());
app.use(cookieParser())

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
app.use('/api/transport', transportRoutes);
app.use('/api/hostel', hostelRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/notices',   noticeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/promotion', promotionRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/online-payments', onlinePaymentRoutes);

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
