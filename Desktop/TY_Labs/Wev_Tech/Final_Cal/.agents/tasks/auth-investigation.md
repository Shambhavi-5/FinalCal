# Authentication Investigation Report

## Summary

This project uses **session-based authentication** (express-session with MongoDB store), NOT JWT tokens. The core authentication logic in `authRoutes.js` appears structurally correct: it uses `bcrypt.compare()` for password verification and properly retrieves the passwordHash using `.select("+passwordHash")`. However, there are potential issues related to CORS configuration and how the client stores/sends credentials.

**NOTE**: The notification from the parent session mentioned JWT-related bugs (token not returned, hardcoded JWT secret, missing token verification). The code I examined does NOT contain JWT implementation—it uses session-based auth. Either the buggy JWT code is in a different file that I could not locate, or it has already been replaced with session-based auth.

---

## Evidence and Findings

### 1. Authentication Middleware (`server/middleWare/requireAuth.js`)

**Lines examined**: Entire file (7 lines)

```javascript
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      message: "Please log in to continue.",
    });
  }
  next();
}
```

**Assessment**: This middleware is correct for session-based auth. It checks for `req.session.userId` which is set during login/signup.

---

### 2. Authentication Routes (`server/routes/authRoutes.js`)

**Password Comparison (Lines 93-97)**:
```javascript
const user = await User.findOne({ email }).select("+passwordHash");

if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
  return res.status(401).json({
    message: "Incorrect email or password.",
  });
}
```

**Assessment**: The bcrypt password comparison logic is CORRECT. It retrieves the user with `+passwordHash` (overriding the schema's `select: false`) and uses `bcrypt.compare()` to verify the password.

**Session Setup (Lines 99-121)**:
```javascript
req.session.regenerate((error) => {
  if (error) {
    return res.status(500).json({
      message: "Could not start your session.",
    });
  }

  req.session.userId = user._id.toString();
  req.session.userName = user.name;
  req.session.userEmail = user.email;

  req.session.save((saveError) => {
    if (saveError) {
      return res.status(500).json({
        message: "Could not save your session.",
      });
    }

    res.json({
      message: "Welcome back.",
      user: publicUser(user),
    });
  });
});
```

**Assessment**: Session creation logic is correct with proper error handling at each step.

---

### 3. User Model (`server/models/User.js`)

**Schema (Lines 4-19)**:
```javascript
passwordHash: {
  type: String,
  required: true,
  select: false,  // Password hash not returned by default in queries
},
```

**Assessment**: The `select: false` is correctly handled in authRoutes.js by using `.select("+passwordHash")` when needed.

---

### 4. Server Configuration (`server/server.js`)

**Session Configuration (Lines 32-45)**:
```javascript
app.use(
  session({
    name: "ebb.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
      ttl: 14 * 24 * 60 * 60,
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 14 * 24 * 60 * 60 * 1000,
      path: "/",
    },
  })
);
```

**Assessment**: Session configuration is correct. `credentials: true` is set in CORS config.

**CORS Configuration (Lines 27-31)**:
```javascript
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
```

**Assessment**: CORS allows credentials from localhost:5173. **Potential Issue**: This is hardcoded and may cause issues if the frontend runs on a different port or domain.

---

### 5. Task Routes (`server/routes/taskRoutes.js`)

**Middleware Application (Line 24)**:
```javascript
router.use(requireAuth);
```

**Assessment**: Auth middleware is correctly applied to all task routes.

---

### 6. Environment Variables (`server/.env`)

```
PORT=5000
MONGO_URI=mongodb+srv://FinalCal:FinalCal%4025@finalcal.w0impl0.mongodb.net/
SESSION_SECRET=b2a9c6abdf94f8ab4e10affd61dd64afc6a98603bbc5b88bfa306954c732b6db
```

**Assessment**: No JWT_SECRET present because this is session-based auth, not JWT.

---

## Potential Issues Identified

### Issue 1: Hardcoded CORS Origin
**File**: `server/server.js` (Line 28)
**Problem**: The CORS origin is hardcoded to `"http://localhost:5173"`
**Impact**: Authentication will fail if:
- Frontend runs on a different port
- Frontend runs on localhost with a different port
- Frontend runs on a different domain/hostname

**Fix**: Make the CORS origin configurable via environment variable:
```javascript
origin: process.env.CORS_ORIGIN || "http://localhost:5173",
```

---

### Issue 2: Missing Session Secret Validation
**File**: `server/server.js` (Lines 19-21)
```javascript
if (!process.env.MONGO_URI || !process.env.SESSION_SECRET) {
  console.error("Missing MONGO_URI or SESSION_SECRET in server/.env");
  process.exit(1);
}
```

**Assessment**: This check is present and correct.

---

### Issue 3: No Request Validation for Non-Existing Fields
**File**: `server/routes/authRoutes.js`
**Problem**: While input validation exists for required fields, there's no validation against extra unexpected fields in `req.body`.
**Impact**: Minimal security impact but could allow unexpected data.

---

## Conclusion

The session-based authentication implementation appears **structurally sound**. The password comparison logic using bcrypt is correct, and sessions are properly created, stored, and verified.

If authentication is not working, the likely causes are:

1. **Client-side cookie configuration**: Ensure the client is configured to send credentials (cookies) with requests
2. **CORS mismatch**: The hardcoded localhost:5173 may not match the actual frontend origin
3. **Session not being sent**: Check browser DevTools to verify the `ebb.sid` cookie is being sent with API requests
4. **Database connection**: Verify MongoDB connection is working and sessions are being stored

---

## Recommendations

1. **Check client-side code** to verify it's sending credentials with fetch/axios requests (e.g., `credentials: "include"` in fetch options)
2. **Verify CORS origin** matches the frontend URL exactly
3. **Check browser DevTools** → Application → Cookies to confirm `ebb.sid` cookie exists after login
4. **Check browser DevTools** → Network to verify the cookie is being sent with API requests to `/api/tasks`
5. **Add logging** to `requireAuth` to see if `req.session` and `req.session.userId` are present

---

*Report generated for workflow investigation. No code modifications made.*