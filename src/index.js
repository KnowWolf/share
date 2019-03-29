const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const logger = require('morgan');
const consola = require('consola');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const methodOverride = require('method-override');
const flash = require('express-flash');
const MongoStore = require('connect-mongo')(session);
const csrf = require('csurf');
const rateLimit = require('express-rate-limit');
const middleware = require('./middleware');
const User = require('./models/user');

// Load enviroment variables from .env file
require('dotenv').config()

// Initilate Express
const app = express();
// Set host and port
app.set('host', process.env.IP || '0.0.0.0');
app.set('port', process.env.PORT || 5050);

// True Proxy
if (process.env.PROXY) { app.enable("trust proxy") }

const limiter = rateLimit({
  windowMs: 1000 * 60 * 15, // 15 minutes
  max: 50
});

// Load Assets from Public folder
app.use(express.static(__dirname + '/public'));

// Set view mode
app.set('view engine', 'ejs');

// Enable method override
app.use(methodOverride('_method'));

// Sets the view directory
app.set('views', (__dirname + '/views'));

if (!process.env.NODE_ENV === 'development') {
  return app.use(logger('combined'));
} else {
  app.use(logger('dev'));
}

// Setup Session config
let sess = {
  resave: false,
  saveUninitialized: false,
  secret: process.env.COOKIE_SECRET,
  cookie: {
    maxAge: 120960000
  }, // Two weeks in milliseconds
  name: process.env.COOKIE_NAME,
  store: new MongoStore({
    url: process.env.DATABASE_URI,
    autoReconnect: true,
  })
}

if (app.get('env') === 'production') {
  sess.cookie.secure = true // serve secure cookies
}

// Session store
app.use(session(sess));

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport config
passport.use(User.createStrategy());

// Passport needed stuff
passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => {
    done(null, user);
  });
});

// Express Flash
app.use(flash());

// Body parser
app.use(bodyParser.urlencoded({
  extended: true
}))

// Cookie Parser
app.use(cookieParser(process.env.COOKIE_SECRET));

// Express Locals
app.use((req, res, next) => {
  // NodeJS Lib
  res.locals.moment = require('moment');
  // Pass req infomation to the locals
  res.locals.currentUser = req.user;
  res.locals.currentPath = req.path;
  // Custom ENV
  res.locals.siteTitle = process.env.TITLE;
  res.locals.footerTitle = process.env.FOOTER_TITLE;
  res.locals.siteWebmasterEmail = process.env.EMAIL;
  res.locals.signups = process.env.SIGNUPS;
  // Pass flash to locals
  res.locals.info = req.flash('info');
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  // Other
  res.locals.host = req.headers.host;
  res.locals.currentYear = new Date().getFullYear();
  next();
});

// Disables the powered by so it does not show express
app.disable('x-powered-by');

const csrfExclusion = ['/api/upload', '/api/upload/image', '/api/upload/text', '/api/upload/file'];

app.use(function (req, res, next) {
  if (csrfExclusion.indexOf(req.path) !== -1) {
    next();
  }
  else {
    csrf()(req, res, next);
  }
});

const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const meRoutes = require('./routes/me');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');
app.use(indexRoutes);
app.use(authRoutes);
app.use('/user', limiter, middleware.isAlreadyLoggedIn, userRoutes);
app.use('/me', middleware.isLoggedIn, meRoutes);
app.use('/admin', middleware.isAdmin, adminRoutes);
app.use('/api', limiter, apiRoutes)

app.use(function (err, req, res, next) {
  if (err.code !== 'EBADCSRFTOKEN') return next(err)
  // handle CSRF token errors here
  res.status(403)
  res.json({
    message: 'NO CSRF TOKEN',
    error: {}
  });
});
app.get('*', function (req, res) {
  res.status(404).render('errors/404');
});

// Mongoose Setup
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);

// Mongoose Connect
mongoose.connect(process.env.DATABASE_URI, {
  useNewUrlParser: true,
  autoReconnect: true
})

const db = mongoose.connection;


// MongoDB Error
db.on('error', () => {
  consola.error(new Error('MongoDB connection error. Please make sure MongoDB is running.`'));
});

// MongoDB Connected
db.once('open', () => {
  consola.ready({
    message: 'Database',
    badge: true
  });
  // Starts the express server
  app.listen(app.get('port'), () => {
    consola.ready({
      message: 'Web',
      badge: true
    });
    // Log infomation after everything is started.
    consola.log('----------------------------------------')
    consola.info(`Environment: ${app.get('env')}`)
    consola.info(`Base URL: http://localhost:${app.get('port')}`)
    consola.info('Press CTRL-C to stop\n');
    consola.log('----------------------------------------')
  });
});

// Cloes connection to mongodb on exit.
process.on('SIGINT', function () {
  mongoose.connection.close(function () {
    consola.success('Mongoose connection is disconnected due to application termination');
    process.exit(0);
  });
});
