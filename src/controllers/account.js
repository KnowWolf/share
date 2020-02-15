const moment = require('moment');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs-extra');
const { authenticator } = require('otplib');

const generate = require('nanoid/generate');
const sendgrid = require('../config/sendgrid');

const alphabet =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Load MongoDB models.
 */
const User = require('.././models/User');
const Upload = require('.././models/Upload');
const Token = require('.././models/Token');

/**
 * Load Email Templates.
 */
const newEmailVerificationEmail = require('../emails/NewEmailVerify');

/**
 * Update account Controler - Allows users to update basic account details.
 */
exports.putAccount = async (req, res, next) => {
  try {
    // TODO  Add middleware vaildation for username,email,
    // password if the old password is there
    // Add verify people can't change there name
    const {
      username,
      email,
      oldPassword,
      newPassword,
      confirmNewPassword
    } = req.body;
    let successMsg = 'Account details has been updated';

    // This is due to checkbox so I can see if its true or false
    const streamerMode = req.body.streamerMode || false;
    if (
      username === req.user.username &&
      email === req.user.email &&
      streamerMode === req.user.streamerMode &&
      oldPassword
    ) {
      req.flash('error', 'You have not changed any details');
      return res.redirect('/account');
    }
    const user = await User.findById(req.user.id);

    if (username !== req.user.username) {
      user.username = username;
    }
    if (streamerMode !== req.user.streamerMode) {
      user.streamerMode = streamerMode;
    }
    if (!req.user.streamerMode && email !== req.user.email) {
      const token = await generate(alphabet, 24);
      const tokenExpire = moment().add('1', 'h');
      user.newEmailVerificationToken = token;
      user.newEmailVerificationTokenExpire = tokenExpire;
      user.newEmail = email;

      successMsg =
        'Account details has been updated but your new email needs to be verified.';

      const emailTemplate = newEmailVerificationEmail(
        user.email,
        user.newEmail,
        user.newEmailVerificationToken
      );

      const msg = {
        to: user.newEmail,
        from: `${process.env.EMAIL_FROM} <noreply@${process.env.EMAIL_DOMAIN}>`,
        subject: `New Email Verification for  ${process.env.TITLE}`,
        html: emailTemplate.html
      };

      if (process.env.NODE_ENV !== 'test') await sendgrid.send(msg);
    }

    await user.save();
    req.flash('success', successMsg);
    res.redirect('/account');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

exports.emailVeirfy = async (req, res, next) => {
  try {
    const user = await User.findOne({
      newEmailVerificationToken: req.params.token
    });

    user.newEmailVerificationToken = undefined;
    user.newEmailVerificationTokenExpire = undefined;
    user.email = user.newEmail;
    user.newEmail = undefined;
    await user.save();

    let successMsg = `Email has been changed to ${user.email}`;
    if (user.streamerMode) {
      successMsg = 'Email has been updated.';
    }

    req.flash('success', successMsg);
    res.redirect('/account');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

exports.resendEmailVeirfy = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    const token = await generate(alphabet, 24);
    const tokenExpire = moment().add('1', 'h');
    user.newEmailVerificationToken = token;
    user.newEmailVerificationTokenExpire = tokenExpire;
    await user.save();

    const emailTemplate = newEmailVerificationEmail(
      user.email,
      user.newEmail,
      user.newEmailVerificationToken
    );

    const msg = {
      to: user.newEmail,
      from: `${process.env.EMAIL_FROM} <noreply@${process.env.EMAIL_DOMAIN}>`,
      subject: `New Email Verification for  ${process.env.TITLE}`,
      html: emailTemplate.html
    };

    if (process.env.NODE_ENV !== 'test') await sendgrid.send(msg);

    req.flash('success', 'A new email verification link has been sent.');
    res.redirect('/account');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

/**
 * Streamer Mode Controller - Turns on or off stremaer mode via a ajax or fetch request.
 */
exports.putStreamerMode = async (req, res, next) => {
  try {
    const boolean = req.params.boolean === 'true';
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        streamerMode: boolean
      },
      { $safe: true, $upsert: true }
    );
    await user.save();
    res.json({
      message: `Streamer mode has been turned ${boolean ? 'on' : 'off'}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

/**
 * Setup MFA Controller - Allows users to setup MFA for there account
 */
exports.postMfaSetup = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const secret = authenticator.generateSecret();

    const otpauth = authenticator.keyuri(user.email, process.env.TITLE, secret);
    qrcode.toDataURL(otpauth, (err, imageUrl) => {
      if (err) {
        console.error(err);
        res.status(500).send('Server error');
      }
      res.json({
        qrcode: imageUrl,
        mfaSecret: secret,
        status: 200
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

/**
 * Verify MFA Controller - Users must verify MFA before it can be enabled
 */
exports.postMfaSetupVerify = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const { token, secret } = req.body;
    const isValid = authenticator.verify({ token, secret });

    console.log(isValid);
    if (!isValid) {
      return res.status(400).json({
        message: 'Invaild token.  Please try again.',
        status: 400
      });
    }

    user.mfa = true;
    user.mfaSecret = secret;
    await user.save();

    res.json({ message: 'MFA has been enabled.', status: 200 });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

/**
 * Update MFA Controller - Allows users to update MFA
 */
exports.deleteMFA = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    user.mfa = false;
    user.mfaSecret = undefined;
    await user.save();

    res.json({ message: 'MFA has been disabled.', status: 200 });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

/**
 * Delete account Controller - Allows the user to delete there accunt and all data with it.  #GDPR
 */
exports.deleteAccount = async (req, res, next) => {
  try {
    await Token.deleteMany({ user: req.user.id });

    const uploads = await Upload.find({
      uploader: req.user.id
    });

    uploads.map(async data => {
      try {
        const uploadedFileExt = data.fileExtension;
        const uploadedFileName = data.fileName;

        const uploadedFilePath = `${path.join(
          __dirname,
          '../public'
        )}/u/${uploadedFileName + uploadedFileExt}`;

        await Upload.findOneAndDelete({
          fileName: uploadedFileName
        });
        await fs.remove(uploadedFilePath);
      } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
      }
    });

    await User.findByIdAndDelete(req.user.id);

    req.logout();
    req.flash('success', 'Your account and all data with it has been removed');
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};
