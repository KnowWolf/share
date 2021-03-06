const generate = require('nanoid/generate');

const alphabet =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// eslint-disable-next-line prefer-const
let onetime = '';

/**
 * Load MongoDB models.
 */
const User = require('../models/User');

/**
 * Owner Controller- Makes a token.
 */
exports.getOwner = async (req, res) => {
  // Creates a onetime token.
  onetime = generate(alphabet, 32);
  console.log(
    'Use this token to convert yourself to owner. (Only works once*)'
  );
  console.log(onetime.toString());
  console.log('* Note this resets everytime you reboot the app.');
  res.send(
    'Please check the app console for a onetime token to verify your the owner.'
  );
};

/**
 * Owner Token Controller- Converts a user to owner
 */

exports.getOwnerToken = async (req, res) => {
  // If not logged in
  if (!req.isAuthenticated()) {
    return res.status(404).send('Not found');
  }

  // If no token and it does not match the onetime made in a another requests
  if (req.params.token === undefined || req.params.token !== onetime) {
    return res.status(404).send('Not found');
  }

  // Checks if they are already owner.
  const isAlready = await User.findOne({
    role: 'owner'
  });

  // If they are already owner do nothing
  if (isAlready) {
    return res.status(400).send('Only one owner can be set.');
  }

  // If they are not owner make them a owner.
  await User.findByIdAndUpdate(
    req.user.id,
    {
      role: 'owner'
    },
    {
      $safe: true,
      $upsert: true
    }
  );
  res.redirect('/admin');
};
