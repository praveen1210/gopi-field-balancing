// Extends app.json. Push notifications on Android need Firebase's
// google-services.json (free). It is added only when the file is present, so
// builds keep working before Firebase is set up.
// See docs/DEPLOYMENT.md → "Push notifications".
const fs = require('node:fs');
const path = require('node:path');

module.exports = ({ config }) => {
  const googleServices = path.join(__dirname, 'google-services.json');
  if (!fs.existsSync(googleServices)) {
    return config;
  }
  return {
    ...config,
    android: { ...config.android, googleServicesFile: './google-services.json' },
  };
};
