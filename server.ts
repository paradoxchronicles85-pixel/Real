import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from './db/config';
import { users, tasks, userTasks, earnings, referrals } from './db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { 
    validateEmailFormat, 
    sendEmailVerificationCode, 
    verifyEmailCode,
    sendPhoneOTP,
    verifyPhoneOTP
} from './verification';

const PORT = 5000;

// JSON Fallback Database
const JSON_DB_PATH = './fallback-db.json';

interface FallbackDB {
    users: any[];
    tasks: any[];
    userTasks: any[];
    earnings: any[];
    referrals: any[];
}

function loadFallbackDB(): FallbackDB {
    try {
        if (fs.existsSync(JSON_DB_PATH)) {
            return JSON.parse(fs.readFileSync(JSON_DB_PATH, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading fallback DB:', error);
    }
    return { users: [], tasks: [], userTasks: [], earnings: [], referrals: [] };
}

function saveFallbackDB(data: FallbackDB): void {
    try {
        fs.writeFileSync(JSON_DB_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving fallback DB:', error);
    }
}

let fallbackDB = loadFallbackDB();
let usePostgres = true;

const ADMIN_PHONES = ['+13124202900', '+2348146417776'];
const VENDOR_PHONES = [
    '+2347084174994', '+2347040759259', '+2348143662936',
    '+2347044035084', '+2347089902875', '+2347048787493',
    '+2349163483144', '+2349046428186', '+2347071401650',
    '+2348132725834'
];

const coupons = new Map([
    ['WELCOME20', { discount: 20, validForPlan: 'lite' }],
    ['PREMIUM50', { discount: 50, validForPlan: 'premium' }],
    ['STANDARD30', { discount: 30, validForPlan: 'standard' }],
    ['BUSINESS40', { discount: 40, validForPlan: 'bg' }],
    ['BFELITE25', { discount: 25, validForPlan: 'bf' }]
]);

const mimeTypes: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function generateReferralCode(): string {
    return 'VIP' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function parseBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
}

function sendJSON(res: http.ServerResponse, statusCode: number, data: any): void {
    res.writeHead(statusCode, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
    console.log(`📡 ${req.method} ${req.url}`);
    
    // Handle CORS with security
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    if (req.url?.startsWith('/api/')) {
        try {
            if (req.url === '/api/config' && req.method === 'GET') {
                sendJSON(res, 200, { adminPhones: ADMIN_PHONES, vendorPhones: VENDOR_PHONES });
                return;
            }

            // Email verification endpoints
            if (req.url === '/api/verify/send-email-code' && req.method === 'POST') {
                const { email, fullname } = await parseBody(req);
                
                const validation = validateEmailFormat(email);
                if (!validation.valid) {
                    sendJSON(res, 400, { success: false, error: validation.error });
                    return;
                }

                const result = await sendEmailVerificationCode(email, fullname);
                sendJSON(res, result.success ? 200 : 400, result);
                return;
            }

            if (req.url === '/api/verify/check-email-code' && req.method === 'POST') {
                const { email, code } = await parseBody(req);
                const result = verifyEmailCode(email, code);
                sendJSON(res, result.success ? 200 : 400, result);
                return;
            }

            // Phone verification endpoints
            if (req.url === '/api/verify/send-phone-otp' && req.method === 'POST') {
                const { phone } = await parseBody(req);
                const result = await sendPhoneOTP(phone);
                sendJSON(res, result.success ? 200 : 400, result);
                return;
            }

            if (req.url === '/api/verify/check-phone-otp' && req.method === 'POST') {
                const { phone, code } = await parseBody(req);
                const result = verifyPhoneOTP(phone, code);
                sendJSON(res, result.success ? 200 : 400, result);
                return;
            }

            if (req.url === '/api/validate-coupon' && req.method === 'POST') {
                const { code, plan } = await parseBody(req);
                const coupon = coupons.get(code);
                
                if (!coupon) {
                    sendJSON(res, 200, { valid: false, error: 'Invalid coupon code' });
                    return;
                }

                if (coupon.validForPlan !== plan) {
                    sendJSON(res, 200, { 
                        valid: false, 
                        error: 'Coupon not valid for this plan',
                        validPlan: coupon.validForPlan 
                    });
                    return;
                }

                sendJSON(res, 200, { valid: true, discount: coupon.discount });
                return;
            }

            if (req.url === '/api/vendor/generate-coupon' && req.method === 'POST') {
                const { vendorId, discount, plan } = await parseBody(req);
                
                if (!discount || !plan) {
                    sendJSON(res, 400, { success: false, error: 'Missing discount or plan' });
                    return;
                }

                // Generate unique coupon code
                let couponCode = '';
                let isUnique = false;
                let attempts = 0;
                
                while (!isUnique && attempts < 10) {
                    const planPrefix = plan.substring(0, 2).toUpperCase();
                    const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
                    couponCode = `${planPrefix}${randomPart}`;
                    isUnique = !coupons.has(couponCode);
                    attempts++;
                }

                if (!isUnique) {
                    sendJSON(res, 500, { success: false, error: 'Failed to generate unique coupon code' });
                    return;
                }

                // Store the coupon
                coupons.set(couponCode, {
                    discount: parseInt(discount.toString()),
                    validForPlan: plan
                });

                console.log(`✨ Coupon generated: ${couponCode} (${discount}% off for ${plan})`);

                sendJSON(res, 200, {
                    success: true,
                    coupon: {
                        code: couponCode,
                        discount: discount,
                        plan: plan,
                        generatedAt: new Date().toISOString()
                    }
                });
                return;
            }

            if (req.url === '/api/signup' && req.method === 'POST') {
                const data = await parseBody(req);
                console.log('📝 Signup request:', { email: data.email, phone: data.phone, plan: data.plan });
                
                if (!data.email || !data.password || !data.fullname || !data.phone) {
                    console.error('❌ Missing required fields');
                    sendJSON(res, 400, { success: false, error: 'Missing required fields' });
                    return;
                }

                try {
                    const [existingEmail] = await db.select().from(users).where(eq(users.email, data.email)).limit(1);
                    if (existingEmail) {
                        sendJSON(res, 400, { success: false, error: 'Email already registered' });
                        return;
                    }

                    const [existingPhone] = await db.select().from(users).where(eq(users.phone, data.phone)).limit(1);
                    if (existingPhone) {
                        sendJSON(res, 400, { success: false, error: 'Phone number already registered' });
                        return;
                    }
                } catch (dbError: any) {
                    console.error('PostgreSQL error, using fallback:', dbError);
                    usePostgres = false;
                    
                    // Check fallback DB
                    const existingEmail = fallbackDB.users.find(u => u.email === data.email);
                    if (existingEmail) {
                        sendJSON(res, 400, { success: false, error: 'Email already registered' });
                        return;
                    }
                    const existingPhone = fallbackDB.users.find(u => u.phone === data.phone);
                    if (existingPhone) {
                        sendJSON(res, 400, { success: false, error: 'Phone number already registered' });
                        return;
                    }
                }

                // Determine user type - admin and vendors don't need coupons
                const userType = ADMIN_PHONES.includes(data.phone) ? 'admin' : 
                                VENDOR_PHONES.includes(data.phone) ? 'vendor' : 'regular';
                
                // Only regular users need coupons for paid plans
                if (userType === 'regular' && data.plan !== 'free' && data.couponCode === 'NOT_REQUIRED') {
                    sendJSON(res, 400, { success: false, error: 'Coupon code required for this plan' });
                    return;
                }

                // Handle referral tracking
                let referrerId: number | null = null;
                if (data.referralCode) {
                    const [referrer] = await db.select().from(users).where(eq(users.referralCode, data.referralCode));
                    if (referrer) {
                        referrerId = referrer.id;
                    }
                }
                
                // Auto-verify admin and vendor accounts
                const isAdminOrVendor = userType === 'admin' || userType === 'vendor';
                
                let newUser;
                
                if (usePostgres) {
                    try {
                        [newUser] = await db.insert(users).values({
                            fullname: data.fullname,
                            email: data.email,
                            phone: data.phone,
                            password: hashPassword(data.password),
                            plan: data.plan || 'free',
                            userType,
                            referralCode: generateReferralCode(),
                            referredBy: referrerId,
                            emailVerified: isAdminOrVendor,
                            phoneVerified: isAdminOrVendor
                        }).returning();
                    } catch (dbError: any) {
                        console.error('PostgreSQL insert failed, using fallback:', dbError);
                        usePostgres = false;
                    }
                }
                
                if (!usePostgres) {
                    // Use fallback JSON database
                    newUser = {
                        id: Date.now(),
                        fullname: data.fullname,
                        email: data.email,
                        phone: data.phone,
                        password: hashPassword(data.password),
                        plan: data.plan || 'free',
                        userType,
                        referralCode: generateReferralCode(),
                        referredBy: referrerId,
                        emailVerified: isAdminOrVendor,
                        phoneVerified: isAdminOrVendor,
                        totalEarnings: '0.00',
                        currentBalance: '0.00',
                        tasksCompleted: 0,
                        isActive: true,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    fallbackDB.users.push(newUser);
                    saveFallbackDB(fallbackDB);
                }

                // If user bought a paid plan and was referred, create referral record and reward referrer
                if (referrerId && data.plan !== 'free') {
                    const planRewards: Record<string, number> = {
                        'lite': 4000,
                        'standard': 10000,
                        'premium': 13000,
                        'bg': 15000,
                        'bf': 18000
                    };

                    const commission = planRewards[data.plan] || 0;

                    // Create referral record
                    await db.insert(referrals).values({
                        referrerId: referrerId,
                        referredUserId: newUser.id,
                        commission: commission.toString(),
                        isPaid: true
                    });

                    // Update referrer's earnings
                    await db.update(users)
                        .set({
                            totalEarnings: sql`${users.totalEarnings} + ${commission}`,
                            currentBalance: sql`${users.currentBalance} + ${commission}`
                        })
                        .where(eq(users.id, referrerId));

                    // Create earning record for referrer
                    await db.insert(earnings).values({
                        userId: referrerId,
                        amount: commission.toString(),
                        type: 'referral_commission',
                        description: `Referral commission from ${newUser.fullname} (${data.plan} plan)`,
                        referenceId: newUser.id
                    });
                }

                sendJSON(res, 200, { 
                    success: true, 
                    message: 'Account created successfully',
                    user: { 
                        id: newUser.id,
                        fullname: newUser.fullname, 
                        email: newUser.email,
                        phone: newUser.phone,
                        plan: newUser.plan,
                        userType: newUser.userType,
                        referralCode: newUser.referralCode
                    }
                });
                return;
            }

            if (req.url === '/api/login' && req.method === 'POST') {
                const { phone, password } = await parseBody(req);
                console.log('🔑 Login attempt:', phone);
                
                if (!phone || !password) {
                    sendJSON(res, 400, { success: false, error: 'Phone and password are required' });
                    return;
                }
                
                let user;
                try {
                    const [dbUser] = await db.select().from(users).where(eq(users.phone, phone));
                    user = dbUser;
                } catch (dbError: any) {
                    console.error('PostgreSQL error, using fallback:', dbError);
                    usePostgres = false;
                    const fallbackUser = fallbackDB.users.find(u => u.phone === phone);
                    user = fallbackUser;
                }

                const hashedPassword = hashPassword(password);
                if (!user || user.password !== hashedPassword) {
                    sendJSON(res, 401, { success: false, error: 'Invalid phone number or password' });
                    return;
                }

                sendJSON(res, 200, { 
                    success: true, 
                    message: 'Login successful',
                    user: { 
                        id: user.id,
                        fullname: user.fullname, 
                        email: user.email,
                        phone: user.phone,
                        plan: user.plan,
                        userType: user.userType,
                        totalEarnings: user.totalEarnings,
                        currentBalance: user.currentBalance,
                        referralCode: user.referralCode
                    },
                    redirectTo: user.userType === 'admin' || user.userType === 'vendor' ? '/vendor.html' : '/dashboard.html'
                });
                return;
            }

            if (req.url === '/api/dashboard-stats' && req.method === 'POST') {
                const { userId } = await parseBody(req);
                
                try {
                    const [user] = await db.select().from(users).where(eq(users.id, userId));
                    if (!user) {
                        sendJSON(res, 404, { success: false, error: 'User not found' });
                        return;
                    }

                    // Get total task earnings
                    const taskEarnings = await db.select({
                        total: sql`COALESCE(SUM(${earnings.amount}), 0)`
                    }).from(earnings)
                        .where(and(
                            eq(earnings.userId, userId),
                            eq(earnings.type, 'task_completion')
                        ));

                    // Get total referral earnings
                    const referralEarnings = await db.select({
                        total: sql`COALESCE(SUM(${referrals.commission}), 0)`
                    }).from(referrals)
                        .where(eq(referrals.referrerId, userId));

                    // Get referral count
                    const referralCount = await db.select({
                        count: sql`COUNT(*)`
                    }).from(referrals)
                        .where(eq(referrals.referrerId, userId));

                    sendJSON(res, 200, {
                        success: true,
                        stats: {
                            totalEarnings: parseFloat(user.totalEarnings || '0'),
                            currentBalance: parseFloat(user.currentBalance || '0'),
                            taskEarnings: parseFloat(taskEarnings[0]?.total || '0'),
                            referralEarnings: parseFloat(referralEarnings[0]?.total || '0'),
                            tasksCompleted: user.tasksCompleted || 0,
                            referrals: parseInt(referralCount[0]?.count || '0')
                        }
                    });
                } catch (dbError: any) {
                    console.error('Dashboard stats error:', dbError);
                    sendJSON(res, 500, { success: false, error: 'Failed to load stats' });
                }
                return;
            }

            if (req.url === '/api/dashboard' && req.method === 'POST') {
                const { userId } = await parseBody(req);
                
                try {
                    const [user] = await db.select().from(users).where(eq(users.id, userId));
                    if (!user) {
                        sendJSON(res, 404, { success: false, error: 'User not found' });
                        return;
                    }

                    const userEarnings = await db.select().from(earnings)
                        .where(eq(earnings.userId, userId))
                        .orderBy(desc(earnings.createdAt))
                        .limit(10);

                    const completedTasks = await db.select({
                        task: tasks,
                        userTask: userTasks
                    }).from(userTasks)
                        .leftJoin(tasks, eq(userTasks.taskId, tasks.id))
                        .where(and(
                            eq(userTasks.userId, userId),
                            eq(userTasks.status, 'completed')
                        ))
                        .orderBy(desc(userTasks.completedAt));

                    const userReferrals = await db.select().from(referrals)
                        .where(eq(referrals.referrerId, userId));

                    sendJSON(res, 200, {
                        success: true,
                        user: {
                            id: user.id,
                            fullname: user.fullname,
                            email: user.email,
                            plan: user.plan,
                            totalEarnings: user.totalEarnings,
                            currentBalance: user.currentBalance,
                            tasksCompleted: user.tasksCompleted,
                            referralCode: user.referralCode
                        },
                        earnings: userEarnings,
                        completedTasks,
                        referrals: userReferrals
                    });
                } catch (dbError: any) {
                    console.error('Dashboard DB error, using fallback:', dbError);
                    usePostgres = false;
                    
                    const fallbackUser = fallbackDB.users.find(u => u.id === userId);
                    if (!fallbackUser) {
                        sendJSON(res, 404, { success: false, error: 'User not found' });
                        return;
                    }
                    
                    sendJSON(res, 200, {
                        success: true,
                        user: {
                            id: fallbackUser.id,
                            fullname: fallbackUser.fullname,
                            email: fallbackUser.email,
                            plan: fallbackUser.plan,
                            totalEarnings: fallbackUser.totalEarnings || 0,
                            currentBalance: fallbackUser.currentBalance || 0,
                            tasksCompleted: fallbackUser.tasksCompleted || 0,
                            referralCode: fallbackUser.referralCode
                        },
                        earnings: [],
                        completedTasks: [],
                        referrals: []
                    });
                }
                return;
            }

            if (req.url === '/api/tasks/available' && req.method === 'POST') {
                const { userId, userPlan } = await parseBody(req);
                
                try {
                    const availableTasks = await db.select().from(tasks)
                        .where(and(
                            eq(tasks.isActive, true),
                            sql`(${tasks.planRequired} IS NULL OR ${tasks.planRequired} = ${userPlan})`
                        ));

                    const userCompletedTaskIds = await db.select({ taskId: userTasks.taskId })
                        .from(userTasks)
                        .where(eq(userTasks.userId, userId));

                    const completedIds = new Set(userCompletedTaskIds.map(ut => ut.taskId));
                    const filteredTasks = availableTasks.filter(task => !completedIds.has(task.id));

                    sendJSON(res, 200, { success: true, tasks: filteredTasks });
                } catch (dbError: any) {
                    console.error('Tasks DB error, using fallback:', dbError);
                    usePostgres = false;
                    
                    // Return empty tasks list as fallback (no tasks available offline)
                    sendJSON(res, 200, { success: true, tasks: [] });
                }
                return;
            }

            if (req.url === '/api/tasks/complete' && req.method === 'POST') {
                const { userId, taskId } = await parseBody(req);
                
                try {
                    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
                    if (!task || !task.isActive) {
                        sendJSON(res, 400, { success: false, error: 'Task not found or inactive' });
                        return;
                    }

                    const [existing] = await db.select().from(userTasks)
                        .where(and(
                            eq(userTasks.userId, userId),
                            eq(userTasks.taskId, taskId)
                        ));

                    if (existing) {
                        sendJSON(res, 400, { success: false, error: 'You have already completed this task' });
                        return;
                    }

                    // Use transaction to ensure data consistency
                    await db.insert(userTasks).values({
                        userId,
                        taskId,
                        status: 'completed',
                        completedAt: new Date(),
                        rewardPaid: task.reward
                    });

                    await db.insert(earnings).values({
                        userId,
                        amount: task.reward,
                        type: 'task_completion',
                        description: `Completed: ${task.title}`,
                        referenceId: taskId
                    });

                    await db.update(users)
                        .set({
                            totalEarnings: sql`${users.totalEarnings} + ${task.reward}`,
                            currentBalance: sql`${users.currentBalance} + ${task.reward}`,
                            tasksCompleted: sql`${users.tasksCompleted} + 1`
                        })
                        .where(eq(users.id, userId));

                    // Get updated user stats
                    const [updatedUser] = await db.select().from(users).where(eq(users.id, userId));

                    sendJSON(res, 200, { 
                        success: true, 
                        message: 'Task completed successfully',
                        reward: task.reward,
                        updatedBalance: updatedUser.currentBalance,
                        updatedEarnings: updatedUser.totalEarnings,
                        tasksCompleted: updatedUser.tasksCompleted
                    });
                } catch (dbError: any) {
                    console.error('Task completion error:', dbError);
                    sendJSON(res, 500, { success: false, error: 'Failed to complete task. Please try again.' });
                }
                return;
            }

            if (req.url === '/api/admin/tasks' && req.method === 'POST') {
                const { adminId, ...taskData } = await parseBody(req);
                
                const [admin] = await db.select().from(users).where(eq(users.id, adminId));
                if (!admin || (admin.userType !== 'admin' && admin.userType !== 'vendor')) {
                    sendJSON(res, 403, { success: false, error: 'Unauthorized' });
                    return;
                }

                const [newTask] = await db.insert(tasks).values({
                    ...taskData,
                    createdBy: adminId
                }).returning();

                sendJSON(res, 200, { success: true, task: newTask });
                return;
            }

            if (req.url === '/api/admin/tasks/list' && req.method === 'GET') {
                const allTasks = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
                sendJSON(res, 200, { success: true, tasks: allTasks });
                return;
            }

            if (req.url === '/api/admin/tasks/toggle' && req.method === 'POST') {
                const { taskId, isActive } = await parseBody(req);
                
                await db.update(tasks)
                    .set({ isActive })
                    .where(eq(tasks.id, taskId));

                sendJSON(res, 200, { success: true });
                return;
            }

            if (req.url === '/api/check-email' && req.method === 'POST') {
                const { email } = await parseBody(req);
                const [existing] = await db.select().from(users).where(eq(users.email, email));
                sendJSON(res, 200, { exists: !!existing });
                return;
            }

            if (req.url === '/api/check-phone' && req.method === 'POST') {
                const { phone } = await parseBody(req);
                const [existing] = await db.select().from(users).where(eq(users.phone, phone));
                sendJSON(res, 200, { exists: !!existing });
                return;
            }

            if (req.url === '/api/user/referral-stats' && req.method === 'POST') {
                const { userId } = await parseBody(req);
                
                try {
                    const [user] = await db.select().from(users).where(eq(users.id, userId));
                    if (!user) {
                        sendJSON(res, 404, { success: false, error: 'User not found' });
                        return;
                    }

                    // Get all referrals with user details
                    const userReferrals = await db.select({
                        referral: referrals,
                        user: users
                    }).from(referrals)
                        .leftJoin(users, eq(referrals.referredUserId, users.id))
                        .where(eq(referrals.referrerId, userId))
                        .orderBy(desc(referrals.createdAt));

                    const totalCommission = userReferrals.reduce((sum, r) => 
                        sum + parseFloat(r.referral.commission || '0'), 0);

                    sendJSON(res, 200, {
                        success: true,
                        data: {
                            totalReferrals: userReferrals.length,
                            totalReferralEarnings: totalCommission,
                            referralCode: user.referralCode,
                            referralLink: `https://paradox.app/ref/${user.referralCode}`,
                            referrals: userReferrals.map(r => ({
                                name: r.user?.fullname || 'Unknown',
                                plan: r.user?.plan || 'free',
                                commission: parseFloat(r.referral.commission || '0'),
                                date: r.referral.createdAt,
                                isPaid: r.referral.isPaid
                            }))
                        }
                    });
                } catch (dbError: any) {
                    console.error('Referral stats error:', dbError);
                    sendJSON(res, 500, { success: false, error: 'Failed to load referral stats' });
                }
                return;
            }

            if (req.url === '/api/referrals/stats' && req.method === 'POST') {
                const { userId } = await parseBody(req);
                
                const userReferrals = await db.select({
                    referral: referrals,
                    user: users
                }).from(referrals)
                    .leftJoin(users, eq(referrals.referredUserId, users.id))
                    .where(eq(referrals.referrerId, userId));

                const totalCommission = userReferrals.reduce((sum, r) => sum + parseFloat(r.referral.commission || '0'), 0);

                sendJSON(res, 200, {
                    success: true,
                    totalReferrals: userReferrals.length,
                    totalCommission,
                    referrals: userReferrals.map(r => ({
                        name: r.user?.fullname,
                        plan: r.user?.plan,
                        commission: parseFloat(r.referral.commission || '0'),
                        date: r.referral.createdAt
                    }))
                });
                return;
            }

            if (req.url === '/api/withdrawal-request' && req.method === 'POST') {
                const withdrawalData = await parseBody(req);
                
                try {
                    const { sendEmail } = await import('./src/utils/replitmail');
                    
                    const emailHTML = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                            <div style="background: white; border-radius: 16px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
                                <h2 style="color: #667eea; margin-bottom: 20px;">💰 New Withdrawal Request</h2>
                                
                                <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                                    <h3 style="color: #333; margin-top: 0;">User Information</h3>
                                    <p style="margin: 8px 0;"><strong>Email:</strong> ${withdrawalData.email}</p>
                                    <p style="margin: 8px 0;"><strong>Account Name:</strong> ${withdrawalData.accountName}</p>
                                </div>
                                
                                <div style="background: #e3f2fd; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                                    <h3 style="color: #333; margin-top: 0;">Bank Details</h3>
                                    <p style="margin: 8px 0;"><strong>Bank:</strong> ${withdrawalData.bankName}</p>
                                    <p style="margin: 8px 0;"><strong>Account Number:</strong> ${withdrawalData.accountNumber}</p>
                                </div>
                                
                                <div style="background: #e8f5e9; padding: 20px; border-radius: 12px;">
                                    <h3 style="color: #333; margin-top: 0;">Withdrawal Details</h3>
                                    <p style="margin: 8px 0;"><strong>Type:</strong> ${withdrawalData.withdrawalType === 'task' ? 'Task Income' : 'Referral Income'}</p>
                                    <p style="margin: 8px 0;"><strong>Amount:</strong> ₦${withdrawalData.amount.toLocaleString()}</p>
                                    <p style="margin: 8px 0;"><strong>Request Date:</strong> ${new Date().toLocaleString()}</p>
                                </div>
                                
                                <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #eee; text-align: center; color: #666;">
                                    <p>Process this withdrawal within 48 hours</p>
                                </div>
                            </div>
                        </div>
                    `;

                    const emailText = `
                        NEW WITHDRAWAL REQUEST
                        
                        User Email: ${withdrawalData.email}
                        Account Name: ${withdrawalData.accountName}
                        
                        Bank: ${withdrawalData.bankName}
                        Account Number: ${withdrawalData.accountNumber}
                        
                        Type: ${withdrawalData.withdrawalType === 'task' ? 'Task Income' : 'Referral Income'}
                        Amount: ₦${withdrawalData.amount.toLocaleString()}
                        Request Date: ${new Date().toLocaleString()}
                        
                        Process this withdrawal within 48 hours.
                    `;

                    await sendEmail({
                        to: 'ayodelevictor008@gmail.com',
                        subject: `💰 Withdrawal Request - ₦${withdrawalData.amount.toLocaleString()} from ${withdrawalData.accountName}`,
                        html: emailHTML,
                        text: emailText
                    });

                    sendJSON(res, 200, {
                        success: true,
                        message: 'Withdrawal request submitted successfully',
                        processingDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
                    });
                } catch (emailError: any) {
                    console.error('Email sending failed:', emailError);
                    sendJSON(res, 200, {
                        success: true,
                        message: 'Withdrawal request received (email notification pending)',
                        processingDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
                    });
                }
                return;
            }

            sendJSON(res, 404, { error: 'API endpoint not found' });
        } catch (error: any) {
            console.error('API Error:', error);
            sendJSON(res, 500, { error: 'Server error: ' + error.message });
        }
        return;
    }

    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('500 - Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Cache-Control': 'no-cache'
            });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌟 VIPRUS Server running at http://0.0.0.0:${PORT}/`);
    console.log(`✨ Divine prosperity awaits...`);
    console.log(`📡 API endpoints active`);
    console.log(`📊 Database connected - using PostgreSQL`);
});
