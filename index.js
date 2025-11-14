//npm install dotenv - explain
//npm install express-session - explain
//create the .env file

// Load environment variables from .env file into memory
// Allows you to use process.env
require('dotenv').config();

const express = require("express");

//Needed for the session variable - Stored on the server to hold data
const session = require("express-session");

let path = require("path");

const multer = require('multer');

// Allows you to read the body of incoming HTTP requests and makes that data available on req.body
let bodyParser = require("body-parser");

let app = express();

// Use EJS for the web pages - requires a views folder and all files are .ejs
app.set("view engine", "ejs");

// Root directory for static images
const uploadRoot = path.join(__dirname, "images");
// Sub-directory where uploaded profile pictures will be stored
const uploadDir = path.join(uploadRoot, "uploads");
// cb is the callback function
// The callback is how you hand control back to Multer after
// your customization step
// Configure Multer's disk storage engine
// Multer calls it once per upload to ask where to store the file. Your function receives:
// req: the incoming request.
// file: metadata about the file (original name, mimetype, etc.).
// cb: the callback.
const storage = multer.diskStorage({
    // Save files into our uploads directory
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    // Reuse the original filename so users see familiar names
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
// Create the Multer instance that will handle single-file uploads
const upload = multer({ storage });
// Expose everything in /images (including uploads) as static assets
app.use("/images", express.static(uploadRoot));


app.use('/images', express.static(path.join(__dirname, 'images')));

// process.env.PORT is when you deploy and 3000 is for test
const port = process.env.PORT || 3000;
app.listen(port, () => console.log("website running"))

/* Session middleware (Middleware is code that runs between the time the request comes
to the server and the time the response is sent back. It allows you to intercept and
decide if the request should continue. It also allows you to parse the body request
from the html form, handle errors, check authentication, etc.)

REQUIRED parameters for session:
secret - The only truly required parameter
    Used to sign session cookies
    Prevents tampering and session hijacking with session data

OPTIONAL (with defaults):
resave - Default: true
    true = save session on every request
    false = only save if modified (recommended)

saveUninitialized - Default: true
    true = create session for every request
    false = only create when data is stored (recommended)
*/

app.use(
    session(
        {
    secret: process.env.SESSION_SECRET || 'fallback-secret-key',
    resave: false,
    saveUninitialized: false,
        }
    )
);

// const knex = require("knex")({
//     client: "pg",
//     connection: {
//         host : process.env.DB_HOST || "localhost",
//         user : process.env.DB_USER || "postgres",
//         password : process.env.DB_PASSWORD || "pgadmin4",
//         database : process.env.DB_NAME || "foodisus",
//         port : process.env.DB_PORT || 5432  // PostgreSQL 16 typically uses port 5434
//     }
// });

const knex = require("knex")({
    client: "pg",
    connection: {
        host: process.env.RDS_HOSTNAME || "awseb-e-mumpdqsemx-stack-awsebrdsdatabase-xqwhzbsem7kf.cyjdgkggv8nb.us-east-1.rds.amazonaws.com",
        user: process.env.RDS_USERNAME || "postgres",
        password: process.env.RDS_PASSWORD || "pgadmin4",
        database: process.env.RDS_DB_NAME || "postgres",
        port: process.env.RDS_PORT || 5432,
        ssl: process.env.DB_SSL ? {rejectUnauthorized: false} : false 
    }
});

// Tells Express how to read form data sent in the body of a request
app.use(express.urlencoded({extended: true}));

// Global authentication middleware - runs on EVERY request
app.use((req, res, next) => {
    // Skip authentication for login routes
    if (req.path === '/' || req.path === '/login' || req.path === '/logout') {
        //continue with the request path
        return next();
    }
    
    // Check if user is logged in for all other routes
    if (req.session.isLoggedIn) {
        //notice no return because nothing below it
        next(); // User is logged in, continue
    } 
    else {
        res.render("login", { error_message: "Please log in to access this page" });
    }
});

// Main page route - notice it checks if they have logged in
app.get("/", (req, res) => {
    // Check if user is logged in
    if (req.session.isLoggedIn) {        
        res.render("index");
    } 
    else {
        res.render("login", { error_message: "" });
    }
});



// This creates attributes in the session object to keep track of user and if they logged in
app.post("/login", (req, res) => {
    let sName = req.body.username;
    let sPassword = req.body.password;

    knex.select("username", "password")
        .from('users')
        .where("username", sName)
        .andWhere("password", sPassword)
        .then(users => {
        // Check if a user was found with matching username AND password
        if (users.length > 0) {
            req.session.isLoggedIn = true;
            req.session.username = sName;
            res.redirect("/");
        } else {
            // No matching user found
            res.render("login", { error_message: "Invalid login" });
        }
        })
        .catch(err => {
        console.error("Login error:", err);
        res.render("login", { error_message: "Invalid login" });
        });
});

// Logout route
app.get("/logout", (req, res) => {
    // Get rid of the session object
    req.session.destroy((err) => {
        if (err) {
            console.log(err);
        }
        res.redirect("/");
    });
});


app.listen(port, () => {
    console.log("The server is listening");
});


app.get('/test', (req, res) => {
    // Check if user is logged in
    if (req.session.isLoggedIn) {
        res.render('test', {name: 'BYU'});
    }
    else {
        res.render('login', {error_message: ''});
    }
});

app.get("/users", (req, res) => {
  // Check if user is logged in
    if (req.session.isLoggedIn) {
        knex.select().from("users")
        .then(users => {
            console.log(`Successfully retrieved ${users.length} users from database`);
            res.render("displayUsers", {users: users});
        })
        .catch((err) => {
            console.error("Database query error:", err.message);
            res.render("displayUsers", {
            users: [],
            error_message: `Database error: ${err.message}. Please check if the 'users' table exists.`
            });
        });
    }
    else {
        res.render("login", { error_message: "" });
    }
});

app.get("/addUser", (req, res) => {
    res.render('addUser')
});

app.post("/addUser", upload.single("profileImage"), (req, res) => {
    // Destructuring grabs them regardless of field order.
    const { username, password } = req.body;
    // Basic validation to ensure required fields are present.
    if (!username || !password) {
        return res.status(400).render("addUser", { error_message: "Username and password are required." });
    }
    // Build the relative path to the uploaded file so the
    // browser can load it later.
    const profileImagePath = req.file ? `/images/uploads/${req.file.filename}` : null;
    // Shape the data to match the users table schema.
    // Object literal - other languages use dictionaries
    // When the object is inserted with Knex, that value profileImagePath,
    // becomes the database column profile_image, so the saved path to
    // the uploaded image ends up in the profile_image column for that user.
    const newUser = {
        username,
        password,
        profile_image: profileImagePath
    };
    // Insert the record into PostgreSQL and return the user list on success.
    knex("users")
        .insert(newUser)
        .then(() => {
            res.redirect("/users");
        })
        .catch((dbErr) => {
            console.error("Error inserting user:", dbErr.message);
            // Database error, so show the form again with a generic message.
            res.status(500).render("addUser", { error_message: "Unable to save user. Please try again." });
        });
});


// Content Security Policy middleware - allows localhost connections for development
// This fixes the CSP violation error with Chrome DevTools
app.use((req, res, next) => {
// Set a permissive CSP for development that allows localhost connections
// This allows Chrome DevTools to connect to localhost:3000
res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' http://localhost:* ws://localhost:* wss://localhost:*; " +
    "connect-src 'self' http://localhost:* ws://localhost:* wss://localhost:*; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' https://cdn.jsdelivr.net;"
);
next();
});


app.post("/deleteUser/:id", (req, res) => {
    knex("users").where("id", req.params.id).del().then(users => {
        res.redirect("/users");
    }).catch(err => {
        console.log(err);
        res.status(500).json({err});
    })
});











