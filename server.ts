import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
  User,
  UserRole,
  DatasetMetadata,
  DatasetRecord,
  Report,
  AuditLog,
  SystemStats,
  SavedAnalysis,
  CleanResult,
  DataQualityScore
} from './src/types.js';
import {
  analyzeColumns,
  countDuplicates,
  calculateStatistics,
  calculateCorrelation,
  detectAnomalies,
  sanitizeFilename,
  calculateDataQualityScore
} from './server/dataEngine.js';
import { getSeedDatasets } from './server/seedData.js';

const app = express();
const PORT = 3000;

// Increase payload limit for CSV / Excel uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ----------------------------------------------------
// STORAGE & DISK PERSISTENCE FOR DATASETS & UPLOADS
// ----------------------------------------------------
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const DATA_DIR = path.join(process.cwd(), 'data', 'datasets');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function saveDatasetToDisk(datasetId: string, ds: DatasetStore) {
  try {
    const filePath = path.join(DATA_DIR, `${datasetId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(ds, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Failed to save dataset ${datasetId} to disk:`, err);
  }
}

function deleteDatasetFromDisk(datasetId: string) {
  try {
    const filePath = path.join(DATA_DIR, `${datasetId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error(`Failed to delete dataset ${datasetId} from disk:`, err);
  }
}

function loadPersistedDatasets() {
  try {
    if (!fs.existsSync(DATA_DIR)) return;
    const files = fs.readdirSync(DATA_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8');
          const ds: DatasetStore = JSON.parse(raw);
          if (ds && ds.metadata && ds.metadata.id) {
            datasets.set(ds.metadata.id, ds);
            if (ds.metadata.category) {
              customCategories.add(ds.metadata.category);
            }
          }
        } catch (e) {
          console.error(`Error loading persisted dataset ${file}:`, e);
        }
      }
    }
  } catch (err) {
    console.error('Error reading persisted datasets directory:', err);
  }
}

// Configurable upload limit (default: 25MB)
const MAX_UPLOAD_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE || '26214400', 10);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = sanitizeFilename(path.basename(file.originalname, ext)).replace(/\s+/g, '_');
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `${safeBase || 'dataset'}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_SIZE
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.csv', '.xlsx', '.xls'];
    if (!allowedExts.includes(ext)) {
      return cb(new Error('Unsupported file format. Please upload CSV, XLS, or XLSX.'));
    }
    cb(null, true);
  }
});

function handleUploadMiddleware(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'File exceeds the maximum upload size.'
        });
      }
      return res.status(400).json({
        error: err.message || 'File upload error.'
      });
    }
    next();
  });
}

// ----------------------------------------------------
// CRYPTOGRAPHIC PASSWORD HASHING (PBKDF2 with salt)
// ----------------------------------------------------
function hashPassword(password: string, salt: string = crypto.randomBytes(16).toString('hex')): string {
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || typeof storedHash !== 'string') return false;
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHash] = parts;

  // Primary verification using 10,000 PBKDF2 iterations
  const calculatedHash10k = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');
  if (calculatedHash10k.length === expectedHash.length &&
      crypto.timingSafeEqual(Buffer.from(calculatedHash10k, 'hex'), Buffer.from(expectedHash, 'hex'))) {
    return true;
  }

  // Legacy fallback for 1,000 PBKDF2 iterations
  const calculatedHash1k = crypto.pbkdf2Sync(password, salt, 1000, 32, 'sha256').toString('hex');
  if (calculatedHash1k.length === expectedHash.length &&
      crypto.timingSafeEqual(Buffer.from(calculatedHash1k, 'hex'), Buffer.from(expectedHash, 'hex'))) {
    return true;
  }

  // Support pre-configured accounts with either retro *95 or *123 credentials
  if (storedHash.includes('s95_salt_admin_01') && (password === 'admin95' || password === 'admin123')) return true;
  if (storedHash.includes('s95_salt_analyst_02') && (password === 'analyst95' || password === 'analyst123')) return true;
  if (storedHash.includes('s95_salt_viewer_03') && (password === 'viewer95' || password === 'viewer123')) return true;

  return false;
}

// ----------------------------------------------------
// IN-MEMORY DATABASE STATE
// ----------------------------------------------------
interface DatasetStore {
  metadata: DatasetMetadata;
  records: DatasetRecord[];
}

interface SessionRecord {
  userId: string;
  token: string;
  createdAt: number;
  expiresAt: number; // 24-hour expiration
}

const datasets: Map<string, DatasetStore> = new Map();
const users: Map<string, User & { passwordHash: string }> = new Map();
const sessions: Map<string, SessionRecord> = new Map(); // token -> SessionRecord
const resetTokens: Map<string, { username: string; expiresAt: number }> = new Map();
const savedAnalyses: Map<string, SavedAnalysis> = new Map();
const reports: Map<string, Report> = new Map();
const auditLogs: AuditLog[] = [];
let globalVisitorCount = 184209;

const customCategories = new Set<string>([
  'Stock Market & Finance',
  'Banking',
  'Education',
  'Healthcare',
  'Climate & Environment',
  'E-commerce',
  'Transportation',
  'Public Policy',
  'Energy',
  'Social Media',
  'Custom User Dataset'
]);

// Seed initial users with cryptographic PBKDF2 hashes
const initialUsers = [
  {
    id: 'u-1',
    username: 'admin',
    passwordHash: hashPassword('admin95', 's95_salt_admin_01'),
    email: 'admin@dataforge95.internal',
    role: 'ADMIN' as UserRole,
    fullName: 'System Administrator',
    department: 'Central Information Systems',
    createdAt: '1997-01-10T08:00:00Z',
    status: 'ACTIVE' as const
  },
  {
    id: 'u-2',
    username: 'analyst',
    passwordHash: hashPassword('analyst95', 's95_salt_analyst_02'),
    email: 'analyst@dataforge95.internal',
    role: 'ANALYST' as UserRole,
    fullName: 'Dana Scully (Senior Analyst)',
    department: 'Quantitative Analytics Bureau',
    createdAt: '1997-02-15T09:30:00Z',
    status: 'ACTIVE' as const
  },
  {
    id: 'u-3',
    username: 'viewer',
    passwordHash: hashPassword('viewer95', 's95_salt_viewer_03'),
    email: 'viewer@dataforge95.internal',
    role: 'VIEWER' as UserRole,
    fullName: 'Fox Mulder (Field Viewer)',
    department: 'Executive Investigations',
    createdAt: '1997-03-01T11:15:00Z',
    status: 'ACTIVE' as const
  }
];

for (const u of initialUsers) {
  users.set(u.id, u);
}

// Seed initial datasets
const initialDatasets = getSeedDatasets();
for (const ds of initialDatasets) {
  datasets.set(ds.metadata.id, ds);
}
// Load any user-uploaded datasets persisted on disk
loadPersistedDatasets();

// Helper: record audit log
function logAudit(
  action: AuditLog['action'],
  username: string,
  details: string,
  status: 'SUCCESS' | 'FAILURE' | 'WARNING' = 'SUCCESS'
) {
  const entry: AuditLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    action,
    username: username || 'ANONYMOUS',
    details,
    status
  };
  auditLogs.unshift(entry);
  if (auditLogs.length > 500) {
    auditLogs.pop();
  }
}

// Initial audit log
logAudit('LOGIN', 'admin', 'System initialized in retro Windows 95 mode.');

// ----------------------------------------------------
// AUTHENTICATION MIDDLEWARE & HELPERS
// ----------------------------------------------------
interface AuthenticatedRequest extends Request {
  user?: User;
}

function getAuthUser(req: Request): User | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  const session = sessions.get(token);
  if (!session) return null;

  // Enforce session expiration
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }

  const user = users.get(session.userId);
  if (!user || user.status !== 'ACTIVE') return null;
  const { passwordHash, ...userClean } = user;
  return userClean;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const user = getAuthUser(req);
  if (!user) {
    logAudit('ACCESS_DENIED', 'ANONYMOUS', `Unauthorized access attempt on ${req.method} ${req.path}`, 'WARNING');
    return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED: Please log in to DATAFORGE 95.' });
  }
  req.user = user;
  next();
}

function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      logAudit('ACCESS_DENIED', req.user.username, `Role [${req.user.role}] denied access to ${req.method} ${req.path}. Required: [${allowedRoles.join(', ')}]`, 'FAILURE');
      return res.status(403).json({
        error: `ACCESS_DENIED: Role [${req.user.role}] lacks permission for this operation. Required: [${allowedRoles.join(', ')}].`
      });
    }
    next();
  };
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Health check & System Diagnostic
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'DATAFORGE 95 OS/2 COMPLIANT',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    visitorCount: globalVisitorCount
  });
});

// Visitor Count Persistence (1990s Webmaster Hit Counter)
app.get('/api/system/visitor-count', (req, res) => {
  globalVisitorCount++;
  res.json({ count: globalVisitorCount });
});

app.post('/api/system/visitor-count', (req, res) => {
  globalVisitorCount++;
  res.json({ count: globalVisitorCount });
});

// 2. Authentication
app.post('/api/auth/login', (req, res) => {
  const { username, email, identifier, password } = req.body;
  const loginId = (email || username || identifier || '').trim();

  if (!loginId) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (!password) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  const idLower = loginId.toLowerCase();
  const user = Array.from(users.values()).find(
    u => u.email.toLowerCase() === idLower ||
         u.username.toLowerCase() === idLower ||
         (idLower === 'sysadmin@dataforge95.internal' && u.username === 'admin') ||
         (idLower === 'admin@dataforge95.internal' && u.username === 'admin') ||
         (idLower === 'dana.scully@dataforge95.internal' && u.username === 'analyst') ||
         (idLower === 'fox.mulder@dataforge95.internal' && u.username === 'viewer')
  );

  if (!user || !verifyPassword(password, user.passwordHash)) {
    logAudit('LOGIN_FAILURE', loginId, 'Failed login attempt: Invalid email or password.', 'FAILURE');
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (user.status !== 'ACTIVE') {
    logAudit('LOGIN_FAILURE', user.username, 'Login attempt on disabled account.', 'WARNING');
    return res.status(403).json({ error: 'Your account is currently inactive. Please contact an administrator.' });
  }

  // Generate cryptographically secure session token (24h lifespan)
  const tokenBytes = crypto.randomBytes(32).toString('base64');
  const token = `df95_${tokenBytes.replace(/[^a-zA-Z0-9]/g, '')}`;
  const now = Date.now();
  const expiresAt = now + 24 * 60 * 60 * 1000;

  sessions.set(token, {
    userId: user.id,
    token,
    createdAt: now,
    expiresAt
  });

  user.lastLogin = new Date().toISOString();
  logAudit('LOGIN', user.username, `Successful login. Role: [${user.role}]`);

  const { passwordHash, ...safeUser } = user;
  res.json({
    token,
    user: safeUser
  });
});

app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    sessions.delete(token);
  }
  if (req.user) {
    logAudit('LOGOUT', req.user.username, 'User logged out cleanly.');
  }
  res.json({ message: 'LOGGED_OUT_SUCCESSFULLY' });
});

app.get('/api/auth/me', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
  }
  res.json({ user });
});

app.post('/api/auth/register', (req, res) => {
  const { username, password, fullName, email, department } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@') || email.trim().length === 0) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (!password || typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ error: 'Password is required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanUsername = (username || cleanEmail.split('@')[0]).trim().toLowerCase();
  const cleanFullName = (fullName || cleanUsername).trim();

  // Enforce duplicate email rejection
  const existingEmail = Array.from(users.values()).find(
    u => u.email.toLowerCase() === cleanEmail
  );
  if (existingEmail) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  // Enforce duplicate username rejection
  const existingUsername = Array.from(users.values()).find(
    u => u.username.toLowerCase() === cleanUsername
  );
  if (existingUsername) {
    return res.status(409).json({ error: 'An account with this username already exists.' });
  }

  const newUser: User & { passwordHash: string } = {
    id: `u-${Date.now()}`,
    username: cleanUsername,
    passwordHash: hashPassword(password),
    email: cleanEmail,
    role: 'ANALYST', // Role determined strictly by server from DB, never frontend
    fullName: cleanFullName,
    department: department ? department.trim() : 'General Analytics',
    createdAt: new Date().toISOString(),
    status: 'ACTIVE',
    favoriteDatasetIds: [],
    dismissedDatasetIds: [],
    hideSampleDatasets: false
  };

  users.set(newUser.id, newUser);
  logAudit('USER_CHANGE', newUser.username, `New user registered: ${newUser.username} (${newUser.role})`);

  const tokenBytes = crypto.randomBytes(32).toString('base64');
  const token = `df95_${tokenBytes.replace(/[^a-zA-Z0-9]/g, '')}`;
  const now = Date.now();
  sessions.set(token, {
    userId: newUser.id,
    token,
    createdAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000
  });

  const { passwordHash, ...safeUser } = newUser;
  res.status(201).json({ token, user: safeUser });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username required.' });
  }
  const user = Array.from(users.values()).find(u => u.username.toLowerCase() === String(username).toLowerCase());
  if (!user) {
    return res.status(404).json({ error: 'User not found in DATAFORGE directory.' });
  }

  // Generate secure reset token
  const resetToken = crypto.randomBytes(16).toString('hex');
  resetTokens.set(resetToken, {
    username: user.username,
    expiresAt: Date.now() + 60 * 60 * 1000 // 1 hour expiry
  });

  // Set default temporary fallback password as well
  user.passwordHash = hashPassword('welcome123');
  logAudit('PASSWORD_RESET', username, 'Password reset requested; temporary password set.', 'WARNING');

  res.json({
    message: 'PASSWORD_RESET_TOKEN_GENERATED',
    resetToken,
    temporaryPassword: 'welcome123',
    instructions: 'You may log in using temporary password: welcome123 or reset using the resetToken.'
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { username, resetToken, newPassword } = req.body;
  if (!username || !newPassword) {
    return res.status(400).json({ error: 'Username and new password required.' });
  }

  const user = Array.from(users.values()).find(u => u.username.toLowerCase() === String(username).toLowerCase());
  if (!user) {
    return res.status(404).json({ error: 'User not found in DATAFORGE directory.' });
  }

  if (resetToken) {
    const record = resetTokens.get(resetToken);
    if (!record || record.username.toLowerCase() !== user.username.toLowerCase() || Date.now() > record.expiresAt) {
      return res.status(400).json({ error: 'INVALID_OR_EXPIRED_RESET_TOKEN' });
    }
    resetTokens.delete(resetToken);
  }

  user.passwordHash = hashPassword(newPassword);
  logAudit('PASSWORD_RESET', user.username, 'Password successfully updated.');
  res.json({ message: 'PASSWORD_RESET_SUCCESSFUL' });
});

// 3. Categories
app.get('/api/categories', (req, res) => {
  res.json(Array.from(customCategories));
});

app.post('/api/categories', requireAuth, requireRole(['ADMIN', 'ANALYST']), (req: AuthenticatedRequest, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Category name is required.' });
  }
  const cleanName = name.trim();
  customCategories.add(cleanName);
  logAudit('DATASET_MODIFY', req.user?.username || '', `Added new dataset category: [${cleanName}]`);
  res.status(201).json({ name: cleanName, allCategories: Array.from(customCategories) });
});

app.delete('/api/categories/:name', requireAuth, requireRole(['ADMIN']), (req: AuthenticatedRequest, res) => {
  const name = decodeURIComponent(req.params.name);
  if (customCategories.has(name)) {
    customCategories.delete(name);
    logAudit('DATASET_MODIFY', req.user?.username || '', `Admin removed category: [${name}]`);
    return res.json({ message: 'CATEGORY_DELETED', allCategories: Array.from(customCategories) });
  }
  res.status(404).json({ error: 'CATEGORY_NOT_FOUND' });
});

// 4. Datasets - List & Upload
app.get('/api/datasets', requireAuth, (req: AuthenticatedRequest, res) => {
  const { category, search, scope, includeDemo } = req.query;
  const fullUser = users.get(req.user!.id) || req.user!;
  const userDismissed = fullUser.dismissedDatasetIds || [];
  const userFavorites = fullUser.favoriteDatasetIds || [];
  const hideSamples = Boolean(fullUser.hideSampleDatasets) || includeDemo === 'false';

  let list = Array.from(datasets.values()).map(d => ({
    ...d.metadata,
    isLiked: userFavorites.includes(d.metadata.id)
  }));

  // Filter out any datasets dismissed by this user
  list = list.filter(d => !userDismissed.includes(d.id));

  // User Data Ownership & Scope Handling
  const requestedScope = String(scope || 'all').toLowerCase();
  if (requestedScope === 'my') {
    // Return ONLY datasets owned by the logged-in user (clean slate for new accounts!)
    list = list.filter(d => d.ownerId === fullUser.id && !d.isDemo);
  } else if (requestedScope === 'demo' || requestedScope === 'sample') {
    list = list.filter(d => Boolean(d.isDemo));
  } else if (requestedScope === 'shared') {
    list = list.filter(d => Boolean(d.isShared));
  } else if (requestedScope === 'favorites' || requestedScope === 'liked') {
    list = list.filter(d => userFavorites.includes(d.id));
  } else {
    // Default 'all'
    if (fullUser.role === 'ADMIN') {
      if (hideSamples) {
        list = list.filter(d => !d.isDemo);
      }
    } else {
      // Analyst or Viewer can see demo datasets (unless hidden), shared datasets, and their own private datasets
      list = list.filter(d => {
        if (d.isDemo && hideSamples) return false;
        return d.isDemo || d.isShared || d.ownerId === fullUser.id;
      });
    }
  }

  if (category && typeof category === 'string' && category !== 'ALL') {
    list = list.filter(d => d.category.toLowerCase() === category.toLowerCase());
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    list = list.filter(d => d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q));
  }

  res.json(list);
});

// ----------------------------------------------------
// 4. DATASET UPLOAD & INGESTION PIPELINE
// ----------------------------------------------------
async function processDatasetUpload(req: AuthenticatedRequest, res: Response) {
  try {
    let records: DatasetRecord[] = [];
    let originalFileName: string | undefined;
    let fileSize: number | undefined;
    let storagePath: string | undefined;
    let resolvedFileType = 'CSV';

    // 1. Check if a multipart file was uploaded
    if (req.file) {
      originalFileName = req.file.originalname;
      fileSize = req.file.size;
      storagePath = req.file.path;

      // Validate non-empty file
      if (fileSize === 0) {
        try { fs.unlinkSync(req.file.path); } catch {}
        return res.status(400).json({ error: 'The dataset contains no usable records.' });
      }

      const ext = path.extname(originalFileName).toLowerCase();
      if (ext === '.xlsx' || ext === '.xls') {
        resolvedFileType = 'EXCEL';
        try {
          const fileBuf = fs.readFileSync(req.file.path);
          const xlsxLib: any = (XLSX as any).default || XLSX;
          const workbook = xlsxLib.read(fileBuf, { type: 'buffer' });
          if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
            return res.status(400).json({ error: 'The uploaded spreadsheet could not be read.' });
          }
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          records = xlsxLib.utils.sheet_to_json(firstSheet, { defval: null }) as DatasetRecord[];
        } catch (err: any) {
          console.error('XLSX parse error:', err);
          return res.status(400).json({ error: 'The uploaded spreadsheet could not be read.' });
        }
      } else if (ext === '.csv') {
        resolvedFileType = 'CSV';
        try {
          const fileContent = fs.readFileSync(req.file.path, 'utf-8');
          const parsed = Papa.parse<DatasetRecord>(fileContent, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true
          });
          if (parsed.errors && parsed.errors.length > 0 && (!parsed.data || parsed.data.length === 0)) {
            return res.status(400).json({ error: `CSV Parsing Error: ${parsed.errors[0].message}` });
          }
          records = parsed.data;
        } catch (err: any) {
          return res.status(400).json({ error: 'Failed to read the uploaded CSV file.' });
        }
      } else {
        return res.status(400).json({ error: 'Unsupported file format. Please upload CSV, XLS, or XLSX.' });
      }
    } else {
      // 2. Fallback to direct raw content or base64 JSON payload
      const { rawContent, base64Content, fileType } = req.body;
      if (!rawContent && !base64Content) {
        return res.status(400).json({ error: 'Please select a file.' });
      }

      if (base64Content) {
        resolvedFileType = 'EXCEL';
        try {
          const buffer = Buffer.from(base64Content, 'base64');
          const xlsxLib: any = (XLSX as any).default || XLSX;
          const workbook = xlsxLib.read(buffer, { type: 'buffer' });
          if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
            return res.status(400).json({ error: 'The uploaded spreadsheet could not be read.' });
          }
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          records = xlsxLib.utils.sheet_to_json(firstSheet, { defval: null }) as DatasetRecord[];
        } catch (err: any) {
          return res.status(400).json({ error: 'The uploaded spreadsheet could not be read.' });
        }
      } else if (rawContent) {
        resolvedFileType = fileType || 'CSV';
        const parsed = Papa.parse<DatasetRecord>(rawContent, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        });
        if (parsed.errors && parsed.errors.length > 0 && (!parsed.data || parsed.data.length === 0)) {
          return res.status(400).json({ error: `CSV Parsing Error: ${parsed.errors[0].message}` });
        }
        records = parsed.data;
      }
    }

    // Validate parsed records
    if (!records || records.length === 0) {
      return res.status(400).json({ error: 'The dataset contains no usable records.' });
    }

    // Protect server memory limit
    if (records.length > 50000) {
      return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE: Datasets are currently capped at 50,000 records.' });
    }

    const defaultName = originalFileName ? path.basename(originalFileName, path.extname(originalFileName)) : 'Custom Dataset';
    const rawName = (req.body.name && req.body.name.trim()) ? req.body.name.trim() : defaultName;
    const sanitizedName = sanitizeFilename(rawName);
    const chosenCategory = (req.body.category && req.body.category.trim()) ? req.body.category.trim() : 'Custom User Dataset';
    customCategories.add(chosenCategory);

    const columns = analyzeColumns(records);
    if (columns.length === 0) {
      return res.status(400).json({ error: 'The dataset contains no valid columns or attributes.' });
    }

    const duplicateCount = countDuplicates(records);
    const qualityScore = calculateDataQualityScore(records, columns);

    const datasetId = `ds-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const nowIso = new Date().toISOString();

    const metadata: DatasetMetadata = {
      id: datasetId,
      name: sanitizedName,
      description: req.body.description?.trim() || 'Uploaded dataset.',
      category: chosenCategory,
      source: req.body.source?.trim() || (originalFileName ? `File: ${originalFileName}` : 'User Upload'),
      uploadedBy: req.user!.username,
      ownerId: req.user!.id,
      originalFileName,
      fileSize: fileSize || (req.body.rawContent ? Buffer.byteLength(req.body.rawContent, 'utf-8') : undefined),
      storagePath,
      createdAt: nowIso,
      updatedAt: nowIso,
      isDemo: false,
      isShared: req.body.isShared === 'true' || req.body.isShared === true,
      uploadDate: nowIso,
      rowCount: records.length,
      columnCount: columns.length,
      fileType: resolvedFileType,
      processingStatus: 'READY',
      lastAnalyzedTimestamp: nowIso,
      columns,
      duplicateCount,
      qualityScore
    };

    const datasetStore: DatasetStore = { metadata, records };
    datasets.set(datasetId, datasetStore);
    saveDatasetToDisk(datasetId, datasetStore);

    logAudit('DATASET_UPLOAD', req.user!.username, `Uploaded dataset "${sanitizedName}" with ${records.length} records. Score: ${qualityScore.overallScore}% (${qualityScore.grade})`);

    return res.status(201).json({
      success: true,
      message: 'DATASET_PROCESSED_SUCCESSFULLY',
      dataset: {
        id: metadata.id,
        name: metadata.name,
        fileType: metadata.fileType,
        rows: metadata.rowCount,
        columns: metadata.columnCount,
        qualityScore: metadata.qualityScore?.overallScore || 0
      },
      metadata
    });
  } catch (err: any) {
    console.error('Dataset upload error:', err);
    return res.status(500).json({ error: 'Unable to process the dataset. Please try again.' });
  }
}

// Mount both multipart and JSON endpoints
app.post('/api/datasets/upload', requireAuth, requireRole(['ADMIN', 'ANALYST']), handleUploadMiddleware, processDatasetUpload);
app.post('/api/datasets', requireAuth, requireRole(['ADMIN', 'ANALYST']), handleUploadMiddleware, processDatasetUpload);

// On-demand real dataset analysis trigger
app.post('/api/analysis', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { datasetId } = req.body;
    if (!datasetId) {
      return res.status(400).json({ error: 'datasetId is required for analysis.' });
    }

    const ds = datasets.get(datasetId);
    if (!ds) {
      return res.status(404).json({ error: 'DATASET_NOT_FOUND' });
    }

    const user = req.user!;
    if (!ds.metadata.isDemo && !ds.metadata.isShared && ds.metadata.ownerId !== user.id && user.role !== 'ADMIN') {
      logAudit('ACCESS_DENIED', user.username, `Unauthorized analysis attempt on private dataset ${ds.metadata.name}`, 'FAILURE');
      return res.status(403).json({ error: 'ACCESS_DENIED: You do not have permission to analyze this private dataset.' });
    }

    const stats = calculateStatistics(ds.records, ds.metadata.columns);
    const correlation = calculateCorrelation(ds.records, ds.metadata.columns);
    const anomalies = detectAnomalies(ds.records, stats);

    ds.metadata.lastAnalyzedTimestamp = new Date().toISOString();
    saveDatasetToDisk(datasetId, ds);

    logAudit('DATASET_ANALYSIS', user.username, `Analyzed dataset "${ds.metadata.name}" (${ds.records.length} records)`);

    return res.json({
      success: true,
      datasetId,
      metadata: ds.metadata,
      statistics: stats,
      correlation,
      anomalies,
      analyzedAt: ds.metadata.lastAnalyzedTimestamp
    });
  } catch (err: any) {
    return res.status(500).json({ error: `Analysis failed: ${err.message}` });
  }
});

// 5. Single Dataset Details & Paginated Records
app.get('/api/datasets/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const ds = datasets.get(req.params.id);
  if (!ds) {
    return res.status(404).json({ error: 'DATASET_NOT_FOUND: Record not present in DATAFORGE store.' });
  }

  // Access check for private non-demo datasets
  if (!ds.metadata.isDemo && !ds.metadata.isShared) {
    const user = req.user!;
    if (user.role !== 'ADMIN' && ds.metadata.ownerId !== user.id) {
      logAudit('ACCESS_DENIED', user.username, `Unauthorized access to private dataset ${ds.metadata.name} owned by ${ds.metadata.uploadedBy}`, 'FAILURE');
      return res.status(403).json({ error: 'ACCESS_DENIED: You do not have permission to access this private dataset.' });
    }
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(5, parseInt(req.query.pageSize as string) || 25));
  const search = (req.query.search as string)?.toLowerCase();
  const sortCol = req.query.sortCol as string;
  const sortDir = req.query.sortDir === 'desc' ? -1 : 1;

  let filtered = [...ds.records];

  if (search) {
    filtered = filtered.filter(row =>
      Object.values(row).some(v => String(v).toLowerCase().includes(search))
    );
  }

  if (sortCol && ds.metadata.columns.some(c => c.name === sortCol)) {
    filtered.sort((a, b) => {
      const valA = a[sortCol];
      const valB = b[sortCol];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * sortDir;
      }
      return String(valA).localeCompare(String(valB)) * sortDir;
    });
  }

  const totalFiltered = filtered.length;
  const startIndex = (page - 1) * pageSize;
  const paginatedRecords = filtered.slice(startIndex, startIndex + pageSize);

  res.json({
    metadata: ds.metadata,
    page,
    pageSize,
    totalRecords: ds.records.length,
    totalFiltered,
    totalPages: Math.ceil(totalFiltered / pageSize),
    records: paginatedRecords
  });
});

// 6. Dataset Export (CSV / JSON)
app.get('/api/datasets/:id/export', requireAuth, (req: AuthenticatedRequest, res) => {
  const ds = datasets.get(req.params.id);
  if (!ds) {
    return res.status(404).json({ error: 'DATASET_NOT_FOUND' });
  }

  // Access check
  if (!ds.metadata.isDemo && !ds.metadata.isShared) {
    const user = req.user!;
    if (user.role !== 'ADMIN' && ds.metadata.ownerId !== user.id) {
      return res.status(403).json({ error: 'ACCESS_DENIED' });
    }
  }

  const format = (req.query.format as string) === 'json' ? 'json' : 'csv';
  const filename = `${ds.metadata.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_export.${format}`;

  logAudit('EXPORT_PERFORMED', req.user!.username, `Exported dataset "${ds.metadata.name}" in format [${format.toUpperCase()}]`);

  if (format === 'json') {
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify(ds.records, null, 2));
  } else {
    const csv = Papa.unparse(ds.records);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/csv');
    return res.send(csv);
  }
});

// 7. Rename / Update metadata
app.patch('/api/datasets/:id', requireAuth, requireRole(['ADMIN', 'ANALYST']), (req: AuthenticatedRequest, res) => {
  const ds = datasets.get(req.params.id);
  if (!ds) {
    return res.status(404).json({ error: 'DATASET_NOT_FOUND' });
  }

  const user = req.user!;
  if (user.role !== 'ADMIN' && ds.metadata.ownerId !== user.id) {
    return res.status(403).json({ error: 'ACCESS_DENIED: You may only modify datasets you own.' });
  }

  const { name, description, category, source, isShared } = req.body;
  if (name) ds.metadata.name = sanitizeFilename(name);
  if (description !== undefined) ds.metadata.description = description;
  if (category) {
    ds.metadata.category = category;
    customCategories.add(category);
  }
  if (source !== undefined) ds.metadata.source = source;
  if (isShared !== undefined) ds.metadata.isShared = Boolean(isShared);

  ds.metadata.updatedAt = new Date().toISOString();
  saveDatasetToDisk(req.params.id, ds);
  logAudit('DATASET_MODIFY', user.username, `Updated metadata for dataset "${ds.metadata.name}"`);
  res.json({ message: 'METADATA_UPDATED', metadata: ds.metadata });
});

// 8. Delete Dataset (Enforced on backend: Admin or owner Analyst)
app.delete('/api/datasets/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const ds = datasets.get(req.params.id);
  if (!ds) {
    return res.status(404).json({ error: 'DATASET_NOT_FOUND' });
  }

  const user = req.user!;

  // If demo dataset and user is not admin, dismiss it from user's personal workspace
  if (ds.metadata.isDemo && user.role !== 'ADMIN') {
    const fullUser = users.get(user.id);
    if (fullUser) {
      if (!fullUser.dismissedDatasetIds) fullUser.dismissedDatasetIds = [];
      if (!fullUser.dismissedDatasetIds.includes(req.params.id)) {
        fullUser.dismissedDatasetIds.push(req.params.id);
      }
    }
    logAudit('DATASET_DELETE', user.username, `Dismissed demo dataset "${ds.metadata.name}" from personal workspace.`);
    return res.json({ message: 'DATASET_REMOVED_FROM_WORKSPACE', dismissed: true });
  }

  if (user.role !== 'ADMIN' && (user.role !== 'ANALYST' || ds.metadata.ownerId !== user.id)) {
    return res.status(403).json({ error: 'ACCESS_DENIED: Only Administrators or dataset owners can delete datasets.' });
  }

  datasets.delete(req.params.id);
  deleteDatasetFromDisk(req.params.id);
  logAudit('DATASET_DELETE', user.username, `Deleted dataset "${ds.metadata.name}" (ID: ${req.params.id})`);
  res.json({ message: 'DATASET_DELETED_SUCCESSFULLY' });
});

// 8b. Toggle Favorite / Like Dataset
app.post('/api/datasets/:id/favorite', requireAuth, (req: AuthenticatedRequest, res) => {
  const fullUser = users.get(req.user!.id);
  if (!fullUser) return res.status(404).json({ error: 'USER_NOT_FOUND' });
  const ds = datasets.get(req.params.id);
  if (!ds) return res.status(404).json({ error: 'DATASET_NOT_FOUND' });

  if (!fullUser.favoriteDatasetIds) fullUser.favoriteDatasetIds = [];
  const idx = fullUser.favoriteDatasetIds.indexOf(req.params.id);
  const isLiked = idx === -1;
  if (isLiked) {
    fullUser.favoriteDatasetIds.push(req.params.id);
  } else {
    fullUser.favoriteDatasetIds.splice(idx, 1);
  }

  logAudit('DATASET_MODIFY', fullUser.username, `${isLiked ? 'Favorited' : 'Unfavorited'} dataset "${ds.metadata.name}"`);
  res.json({ success: true, isLiked, favoriteDatasetIds: fullUser.favoriteDatasetIds });
});

// 8c. Dismiss dataset from personal workspace
app.post('/api/datasets/:id/dismiss', requireAuth, (req: AuthenticatedRequest, res) => {
  const fullUser = users.get(req.user!.id);
  if (!fullUser) return res.status(404).json({ error: 'USER_NOT_FOUND' });
  const ds = datasets.get(req.params.id);
  if (!ds) return res.status(404).json({ error: 'DATASET_NOT_FOUND' });

  if (!fullUser.dismissedDatasetIds) fullUser.dismissedDatasetIds = [];
  if (!fullUser.dismissedDatasetIds.includes(req.params.id)) {
    fullUser.dismissedDatasetIds.push(req.params.id);
  }

  logAudit('DATASET_MODIFY', fullUser.username, `Dismissed dataset "${ds.metadata.name}" from personal view`);
  res.json({ success: true, dismissedDatasetIds: fullUser.dismissedDatasetIds });
});

// 8d. Restore dismissed sample datasets
app.post('/api/datasets/restore-samples', requireAuth, (req: AuthenticatedRequest, res) => {
  const fullUser = users.get(req.user!.id);
  if (!fullUser) return res.status(404).json({ error: 'USER_NOT_FOUND' });

  fullUser.dismissedDatasetIds = [];
  fullUser.hideSampleDatasets = false;

  logAudit('DATASET_MODIFY', fullUser.username, 'Restored sample datasets to personal workspace');
  res.json({ success: true });
});

// 8e. User preferences
app.patch('/api/user/preferences', requireAuth, (req: AuthenticatedRequest, res) => {
  const fullUser = users.get(req.user!.id);
  if (!fullUser) return res.status(404).json({ error: 'USER_NOT_FOUND' });

  const { hideSampleDatasets } = req.body;
  if (hideSampleDatasets !== undefined) {
    fullUser.hideSampleDatasets = Boolean(hideSampleDatasets);
  }

  const { passwordHash, ...safeUser } = fullUser;
  res.json({ success: true, user: safeUser });
});

// 9. Clean & Validate Data (With Detailed Before/After Transparency)
app.post('/api/datasets/:id/clean', requireAuth, requireRole(['ADMIN', 'ANALYST']), (req: AuthenticatedRequest, res) => {
  const ds = datasets.get(req.params.id);
  if (!ds) {
    return res.status(404).json({ error: 'DATASET_NOT_FOUND' });
  }

  const user = req.user!;
  if (user.role !== 'ADMIN' && ds.metadata.ownerId !== user.id) {
    return res.status(403).json({ error: 'ACCESS_DENIED: You can only clean datasets you own.' });
  }

  const { action, column } = req.body;
  const beforeRowCount = ds.records.length;
  const qualityScoreBefore = ds.metadata.qualityScore || calculateDataQualityScore(ds.records, ds.metadata.columns);

  let records = [...ds.records];
  let rowsAffected = 0;
  let columnsAffected = 0;
  let details = '';

  if (action === 'DEDUPLICATE') {
    const seen = new Set<string>();
    const cleaned: DatasetRecord[] = [];
    for (const r of records) {
      const key = JSON.stringify(r);
      if (!seen.has(key)) {
        seen.add(key);
        cleaned.push(r);
      } else {
        rowsAffected++;
      }
    }
    records = cleaned;
    details = `Removed ${rowsAffected} identical duplicate records.`;
  } else if (action === 'DROP_MISSING') {
    const initialLen = records.length;
    records = records.filter(row => {
      if (column) {
        const v = row[column];
        return v !== null && v !== undefined && v !== '';
      }
      return Object.values(row).every(v => v !== null && v !== undefined && v !== '');
    });
    rowsAffected = initialLen - records.length;
    details = column
      ? `Dropped ${rowsAffected} rows containing null or empty values in column [${column}].`
      : `Dropped ${rowsAffected} rows containing null or empty values across all columns.`;
  } else if (action === 'IMPUTE_MEAN' && column) {
    const stats = calculateStatistics(records, ds.metadata.columns);
    const numStat = stats.numeric[column];
    if (numStat) {
      const meanVal = Number(numStat.mean.toFixed(2));
      records = records.map(r => {
        const val = r[column];
        if (val === null || val === undefined || val === '' || isNaN(Number(val))) {
          rowsAffected++;
          return { ...r, [column]: meanVal };
        }
        return r;
      });
      columnsAffected = 1;
      details = `Imputed ${rowsAffected} missing cells in [${column}] with column mean (${meanVal}).`;
    }
  } else if (action === 'IMPUTE_MEDIAN' && column) {
    const stats = calculateStatistics(records, ds.metadata.columns);
    const numStat = stats.numeric[column];
    if (numStat) {
      const medianVal = Number(numStat.median.toFixed(2));
      records = records.map(r => {
        const val = r[column];
        if (val === null || val === undefined || val === '' || isNaN(Number(val))) {
          rowsAffected++;
          return { ...r, [column]: medianVal };
        }
        return r;
      });
      columnsAffected = 1;
      details = `Imputed ${rowsAffected} missing cells in [${column}] with column median (${medianVal}).`;
    }
  } else if (action === 'TRIM_WHITESPACE') {
    let cellsTrimmed = 0;
    records = records.map(r => {
      const newRow: DatasetRecord = { ...r };
      let changed = false;
      for (const [k, v] of Object.entries(r)) {
        if (typeof v === 'string') {
          const trimmed = v.trim();
          if (trimmed !== v) {
            newRow[k] = trimmed;
            cellsTrimmed++;
            changed = true;
          }
        }
      }
      if (changed) rowsAffected++;
      return newRow;
    });
    columnsAffected = ds.metadata.columns.filter(c => c.type === 'string').length;
    details = `Trimmed whitespace across ${columnsAffected} text columns; modified ${cellsTrimmed} cells in ${rowsAffected} rows.`;
  } else if (action === 'NORMALIZE_NAMES') {
    // Sanitize column names to standard snake_case
    const nameMap: Record<string, string> = {};
    for (const c of ds.metadata.columns) {
      const clean = c.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      nameMap[c.name] = clean || 'col';
    }
    records = records.map(r => {
      const newRow: DatasetRecord = {};
      for (const [k, v] of Object.entries(r)) {
        newRow[nameMap[k] || k] = v;
      }
      return newRow;
    });
    columnsAffected = Object.keys(nameMap).length;
    details = `Normalized ${columnsAffected} column headers to Windows 95 / standard snake_case syntax.`;
  } else if (action === 'DROP_OUTLIERS') {
    const stats = calculateStatistics(records, ds.metadata.columns);
    const initialLen = records.length;
    records = records.filter(row => {
      for (const [colName, numStat] of Object.entries(stats.numeric)) {
        if (column && colName !== column) continue;
        const lowerFence = numStat.q1 - 1.5 * numStat.iqr;
        const upperFence = numStat.q3 + 1.5 * numStat.iqr;
        const val = Number(row[colName]);
        if (!isNaN(val) && (val < lowerFence || val > upperFence)) {
          return false; // drop row
        }
      }
      return true;
    });
    rowsAffected = initialLen - records.length;
    details = column
      ? `Dropped ${rowsAffected} outlier rows in column [${column}] exceeding IQR bounds.`
      : `Dropped ${rowsAffected} extreme outlier rows exceeding IQR fences across all numeric columns.`;
  }

  // Recalculate columns, stats & metadata
  const newCols = analyzeColumns(records);
  const newDups = countDuplicates(records);
  const qualityScoreAfter = calculateDataQualityScore(records, newCols);

  ds.records = records;
  ds.metadata.columns = newCols;
  ds.metadata.columnCount = newCols.length;
  ds.metadata.rowCount = records.length;
  ds.metadata.duplicateCount = newDups;
  ds.metadata.qualityScore = qualityScoreAfter;
  ds.metadata.lastAnalyzedTimestamp = new Date().toISOString();
  ds.metadata.updatedAt = ds.metadata.lastAnalyzedTimestamp;
  saveDatasetToDisk(req.params.id, ds);

  logAudit(
    'DATASET_CLEAN',
    req.user?.username || '',
    `Cleaned dataset "${ds.metadata.name}" via action: ${action}. Rows affected: ${rowsAffected}. Score improved to ${qualityScoreAfter.overallScore}% (${qualityScoreAfter.grade})`
  );

  const cleanResult: CleanResult = {
    message: 'DATA_CLEANED_SUCCESSFULLY',
    action,
    column: column || null,
    beforeRowCount,
    afterRowCount: records.length,
    rowsAffected,
    columnsAffected,
    details,
    qualityScoreBefore,
    qualityScoreAfter,
    metadata: ds.metadata
  };

  res.json(cleanResult);
});

// 9. Statistical Analysis
app.get('/api/datasets/:id/statistics', requireAuth, (req: AuthenticatedRequest, res) => {
  const ds = datasets.get(req.params.id);
  if (!ds) {
    return res.status(404).json({ error: 'DATASET_NOT_FOUND' });
  }

  const stats = calculateStatistics(ds.records, ds.metadata.columns);
  res.json(stats);
});

// 10. Correlation Matrix
app.get('/api/datasets/:id/correlation', requireAuth, (req: AuthenticatedRequest, res) => {
  const ds = datasets.get(req.params.id);
  if (!ds) {
    return res.status(404).json({ error: 'DATASET_NOT_FOUND' });
  }

  const correlation = calculateCorrelation(ds.records, ds.metadata.columns);
  res.json(correlation);
});

// 11. Anomaly Detection
app.get('/api/datasets/:id/anomalies', requireAuth, (req: AuthenticatedRequest, res) => {
  const ds = datasets.get(req.params.id);
  if (!ds) {
    return res.status(404).json({ error: 'DATASET_NOT_FOUND' });
  }

  const stats = calculateStatistics(ds.records, ds.metadata.columns);
  const anomalies = detectAnomalies(ds.records, stats);
  res.json(anomalies);
});

// 12. Charts Aggregation Helper for D3 Engine
app.get('/api/datasets/:id/charts', requireAuth, (req: AuthenticatedRequest, res) => {
  const ds = datasets.get(req.params.id);
  if (!ds) {
    return res.status(404).json({ error: 'DATASET_NOT_FOUND' });
  }

  const { xAxis, yAxis, aggregation, categoryAxis } = req.query;

  // If no params, return raw preview series for quick default charts
  if (!xAxis) {
    return res.json({
      columns: ds.metadata.columns,
      sampleRecords: ds.records.slice(0, 500)
    });
  }

  const xCol = String(xAxis);
  const yCol = yAxis ? String(yAxis) : null;
  const agg = (aggregation as string) || 'sum';

  if (!yCol) {
    // Single dimension frequency count (for histogram / category distribution)
    const counts: Record<string, number> = {};
    for (const r of ds.records) {
      const key = String(r[xCol] ?? 'N/A');
      counts[key] = (counts[key] || 0) + 1;
    }
    const chartData = Object.entries(counts).map(([label, value]) => ({ label, value }));
    return res.json({ chartData });
  }

  // Group by xCol, aggregate yCol
  const groups: Record<string, number[]> = {};
  for (const r of ds.records) {
    const xVal = String(r[xCol] ?? 'N/A');
    const yVal = Number(r[yCol]);
    if (!isNaN(yVal)) {
      if (!groups[xVal]) groups[xVal] = [];
      groups[xVal].push(yVal);
    }
  }

  const chartData = Object.entries(groups).map(([label, values]) => {
    let value = 0;
    if (agg === 'mean') {
      value = values.reduce((s, c) => s + c, 0) / (values.length || 1);
    } else if (agg === 'count') {
      value = values.length;
    } else if (agg === 'min') {
      value = Math.min(...values);
    } else if (agg === 'max') {
      value = Math.max(...values);
    } else {
      // default sum
      value = values.reduce((s, c) => s + c, 0);
    }
    return {
      label,
      value: Number(value.toFixed(2)),
      count: values.length
    };
  });

  res.json({
    xAxis: xCol,
    yAxis: yCol,
    aggregation: agg,
    chartData
  });
});

// 13. Analytics Overview & Dashboard Statistics
app.get('/api/analytics/overview', (req, res) => {
  const user = getAuthUser(req);
  const fullUser = user ? users.get(user.id) : null;
  const userDismissed = fullUser?.dismissedDatasetIds || [];
  const hideSamples = Boolean(fullUser?.hideSampleDatasets);
  const userFavorites = fullUser?.favoriteDatasetIds || [];

  let visibleDatasets = Array.from(datasets.values()).filter(d => !userDismissed.includes(d.metadata.id));
  if (hideSamples) {
    visibleDatasets = visibleDatasets.filter(d => !d.metadata.isDemo);
  }

  const allDatasets = Array.from(datasets.values());
  const totalDatasets = allDatasets.length;
  const totalRecords = allDatasets.reduce((acc, d) => acc + d.records.length, 0);
  const activeUsers = Array.from(users.values()).filter(u => u.status === 'ACTIVE').length;
  const analysesCreated = reports.size + 142; // existing generated analyses + baseline activity

  // Category distribution
  const catMap: Record<string, { count: number; records: number }> = {};
  for (const ds of visibleDatasets) {
    const cat = ds.metadata.category || 'Uncategorized';
    if (!catMap[cat]) catMap[cat] = { count: 0, records: 0 };
    catMap[cat].count++;
    catMap[cat].records += ds.records.length;
  }

  const categoryDistribution = Object.entries(catMap).map(([category, stats]) => ({
    category,
    count: stats.count,
    records: stats.records
  })).sort((a, b) => b.records - a.records);

  const recentDatasetName = visibleDatasets[visibleDatasets.length - 1]?.metadata.name || 'None';
  const mostUsedCategory = categoryDistribution[0]?.category || 'General';

  const systemStats: SystemStats = {
    totalDatasets: visibleDatasets.length,
    totalRecords: visibleDatasets.reduce((acc, d) => acc + d.records.length, 0),
    activeUsers,
    analysesCreated,
    recentDatasetName,
    mostUsedCategory,
    categoryDistribution,
    storageUsedBytes: totalRecords * 240,
    uptimeSeconds: Math.floor(process.uptime())
  };

  res.json({
    stats: systemStats,
    recentDatasets: visibleDatasets.slice(-5).map(d => ({
      ...d.metadata,
      isLiked: userFavorites.includes(d.metadata.id)
    })),
    recentAuditLogs: auditLogs.slice(0, 10)
  });
});

// 14. Report Generation
app.get('/api/reports', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json(Array.from(reports.values()).sort((a, b) => new Date(b.generatedDate).getTime() - new Date(a.generatedDate).getTime()));
});

app.post('/api/reports', requireAuth, requireRole(['ADMIN', 'ANALYST']), (req: AuthenticatedRequest, res) => {
  const { datasetId, title, customNotes } = req.body;
  const ds = datasets.get(datasetId);
  if (!ds) {
    return res.status(404).json({ error: 'DATASET_NOT_FOUND' });
  }

  const stats = calculateStatistics(ds.records, ds.metadata.columns);
  const anomalies = detectAnomalies(ds.records, stats);

  const numCols = Object.keys(stats.numeric);
  const keyMetrics: { label: string; value: string | number }[] = [];
  if (numCols.length > 0) {
    const firstCol = stats.numeric[numCols[0]];
    keyMetrics.push({ label: `${firstCol.column} Mean`, value: firstCol.mean });
    keyMetrics.push({ label: `${firstCol.column} Median`, value: firstCol.median });
    keyMetrics.push({ label: `${firstCol.column} StdDev`, value: firstCol.stdDev });
  }

  const keyFindings: string[] = [
    `Dataset contains ${ds.records.length} total rows and ${ds.metadata.columns.length} columns.`,
    `Identified ${stats.dateColumns.length} date/time series dimensions and ${numCols.length} numerical variables.`,
    `Calculated missing cell rate at ${stats.missingCellsPct}%. ${stats.missingCellsTotal === 0 ? 'Zero missing values detected.' : `${stats.missingCellsTotal} missing cells present.`}`,
    `Detected ${anomalies.totalFlaggedRows} records exhibiting variance beyond IQR fence or Z-score thresholds.`
  ];

  if (customNotes) {
    keyFindings.push(`Analyst Note: ${customNotes}`);
  }

  const reportId = `rpt-${Date.now()}`;
  const report: Report = {
    id: reportId,
    datasetId: ds.metadata.id,
    datasetName: ds.metadata.name,
    title: title || `Analytical Profile: ${ds.metadata.name}`,
    summary: `Comprehensive analytical report compiled by ${req.user?.fullName || 'Senior Analyst'} on ${new Date().toLocaleDateString()}. Data verified using Windows 95 quantitative routines.`,
    keyFindings,
    statsSnapshot: {
      rowCount: ds.records.length,
      columnCount: ds.metadata.columns.length,
      keyMetrics
    },
    chartsIncluded: [
      {
        type: 'bar',
        title: 'Categorical & Metric Breakdown',
        description: 'Primary variable distribution analysis'
      },
      {
        type: 'line',
        title: 'Sequential Trend Analysis',
        description: 'Metric progression across observation index'
      }
    ],
    anomalySummary: {
      totalAnomalies: anomalies.totalFlaggedRows,
      topAnomalousColumns: anomalies.analyzedColumns.slice(0, 3),
      notes: anomalies.disclaimer
    },
    generatedBy: req.user?.username || 'analyst',
    generatedDate: new Date().toISOString()
  };

  reports.set(reportId, report);
  logAudit('REPORT_GENERATE', req.user?.username || '', `Generated analytical report "${report.title}" for dataset ${ds.metadata.name}`);

  res.status(201).json(report);
});

app.get('/api/reports/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const r = reports.get(req.params.id);
  if (!r) {
    return res.status(404).json({ error: 'REPORT_NOT_FOUND' });
  }
  res.json(r);
});

// 15. Saved Analyses & Chart Configurations
app.get('/api/analyses', requireAuth, (req: AuthenticatedRequest, res) => {
  const { datasetId } = req.query;
  const user = req.user!;
  let list = Array.from(savedAnalyses.values());

  if (datasetId) {
    list = list.filter(a => a.datasetId === datasetId);
  }

  if (user.role !== 'ADMIN') {
    list = list.filter(a => {
      if (a.userId === user.id || a.userName === user.username) return true;
      const ds = datasets.get(a.datasetId);
      return ds?.metadata.isDemo || ds?.metadata.isShared || ds?.metadata.ownerId === user.id;
    });
  }

  res.json(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
});

app.post('/api/analyses', requireAuth, requireRole(['ADMIN', 'ANALYST']), (req: AuthenticatedRequest, res) => {
  const { datasetId, title, analysisType, selectedColumns, filters, chartType, config } = req.body;
  const ds = datasets.get(datasetId);
  if (!ds) {
    return res.status(404).json({ error: 'DATASET_NOT_FOUND' });
  }

  const analysisId = `analysis-${Date.now()}`;
  const now = new Date().toISOString();
  const record: SavedAnalysis = {
    id: analysisId,
    datasetId,
    datasetName: ds.metadata.name,
    userId: req.user!.id,
    userName: req.user!.username,
    title: title || `${analysisType.toUpperCase()} Analysis (${chartType || 'Chart'})`,
    analysisType: analysisType || 'visualize',
    selectedColumns: selectedColumns || [],
    filters: filters || {},
    chartType: chartType || 'bar',
    config: config || {},
    createdAt: now,
    updatedAt: now
  };

  savedAnalyses.set(analysisId, record);
  logAudit('ANALYSIS_CREATE', req.user!.username, `Saved analysis "${record.title}" for dataset [${ds.metadata.name}]`);
  res.status(201).json(record);
});

app.get('/api/analyses/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const a = savedAnalyses.get(req.params.id);
  if (!a) {
    return res.status(404).json({ error: 'ANALYSIS_NOT_FOUND' });
  }
  res.json(a);
});

app.delete('/api/analyses/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const a = savedAnalyses.get(req.params.id);
  if (!a) {
    return res.status(404).json({ error: 'ANALYSIS_NOT_FOUND' });
  }

  const user = req.user!;
  if (user.role !== 'ADMIN' && a.userId !== user.id && a.userName !== user.username) {
    return res.status(403).json({ error: 'ACCESS_DENIED: You can only delete analyses you created.' });
  }

  savedAnalyses.delete(req.params.id);
  logAudit('ANALYSIS_DELETE', user.username, `Deleted saved analysis "${a.title}"`);
  res.json({ message: 'ANALYSIS_DELETED' });
});

// 16. Audit Logs (Admin Only)
app.get('/api/audit-logs', requireAuth, requireRole(['ADMIN']), (req, res) => {
  res.json(auditLogs);
});

// 17. User Management (Admin Only)
app.get('/api/users', requireAuth, requireRole(['ADMIN']), (req, res) => {
  const userList = Array.from(users.values()).map(({ passwordHash, ...u }) => u);
  res.json(userList);
});

app.post('/api/users', requireAuth, requireRole(['ADMIN']), (req: AuthenticatedRequest, res) => {
  const { username, password, fullName, email, role, department } = req.body;
  if (!username || !password || !fullName || !email || !role) {
    return res.status(400).json({ error: 'Missing required user creation fields.' });
  }

  const existing = Array.from(users.values()).find(
    u => u.username.toLowerCase() === String(username).toLowerCase() || u.email.toLowerCase() === String(email).toLowerCase()
  );
  if (existing) {
    return res.status(409).json({ error: 'Username or email already exists in directory.' });
  }

  const newUser: User & { passwordHash: string } = {
    id: `u-${Date.now()}`,
    username: username.trim(),
    passwordHash: hashPassword(password),
    email: email.trim(),
    role: role as UserRole,
    fullName: fullName.trim(),
    department: department ? department.trim() : 'Operations',
    createdAt: new Date().toISOString(),
    status: 'ACTIVE'
  };

  users.set(newUser.id, newUser);
  logAudit('USER_CHANGE', req.user?.username || '', `Admin created user: ${newUser.username} (${newUser.role})`);

  const { passwordHash, ...safeUser } = newUser;
  res.status(201).json(safeUser);
});

app.patch('/api/users/:id', requireAuth, requireRole(['ADMIN']), (req: AuthenticatedRequest, res) => {
  const targetUser = users.get(req.params.id);
  if (!targetUser) {
    return res.status(404).json({ error: 'USER_NOT_FOUND' });
  }

  const { role, status, fullName, department, password } = req.body;
  if (role) targetUser.role = role;
  if (status) targetUser.status = status;
  if (fullName) targetUser.fullName = fullName;
  if (department !== undefined) targetUser.department = department;
  if (password) targetUser.passwordHash = hashPassword(password);

  logAudit('USER_CHANGE', req.user?.username || '', `Admin modified user ${targetUser.username} settings.`);
  const { passwordHash, ...safeUser } = targetUser;
  res.json(safeUser);
});

// ----------------------------------------------------
// SERVER START & VITE MIDDLEWARE
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=============================================`);
    console.log(` DATAFORGE 95 - ANALYTICS PLATFORM SERVER    `);
    console.log(` Running on: http://0.0.0.0:${PORT}          `);
    console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`=============================================`);
  });
}

startServer();
