const generate = require('nanoid/generate');
const moment = require('moment');
const sendgrid = require('../config/sendgrid');

const alphabet =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Load MongoDB models.
 */
const User = require('../models/User');

/**
 * Load Email Templates.
 */
const AccountActivationEmail = require('../emails/AccountActivation');

/**
 * Signup Controler - Take the users email and password to create their account.
 * Also will send them a email to verify their email address.
 */
exports.postSignup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const slug = username;

    const user = new User({
      username,
      email,
      password,
      slug
    });

    // Set the token and the expire date.
    const token = await generate(alphabet, 24);
    const tokenExpire = moment().add('3', 'h');

    // Sets the token and expire date to the database
    user.emailVerificationToken = token;
    user.emailVerificationTokenExpire = tokenExpire;
    await user.save();

    // Setups the email which is sent to the user.
    const emailTemplate = AccountActivationEmail(token);

    const msg = {
      to: user.email,
      from: `${process.env.EMAIL_FROM} <noreply@${process.env.EMAIL_DOMAIN}>`,
      subject: `Activate your account on ${process.env.TITLE}`,
      html: emailTemplate.html
    };

    // If testing mode then don't send the email.
    if (process.env.NODE_ENV !== 'test') await sendgrid.send(msg);

    req.flash(
      'success',
      'Your account has been created but needs to be activated. Check your email for further instructions.'
    );
    res.redirect('/signup');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

/**
 * Login Controler - This verifys the login details then if vaild
 * creates a user session then redirect to there uploads lising pagge
 */
exports.postLogin = async (req, res) => {
  // Gets the login IP and if it's localhost call it localhost
  const ip =
    req.clientIp === '::1' || req.clientIp === '127.0.0.1'
      ? 'localhost'
      : req.clientIp;

  // Gets the Login IP location if its localhost then it's localhost
  const location =
    req.ipInfo.error !== undefined
      ? 'localhost'
      : `${req.ipInfo.city}, ${req.ipInfo.region} ${req.ipInfo.country}`;

  // Finds the user and updaes the lastLogin ip
  await User.findByIdAndUpdate(
    req.user.id,
    {
      $set: {
        lastLoginIP: ip,
        lastLoginLocation: location
      }
    },
    {
      $safe: true,
      $upsert: true
    }
  );
  req.flash('success', `Welcome back, ${req.user.username}`);
  res.redirect('/');
};

/**
 * Logout Controler - If the user is loggin this will logged
 * them out and remove there session from there browser.
 */
exports.getLogout = async (req, res) => {
  // Removes the user session and logged them outs
  req.logout();
  res.redirect('/');
};
