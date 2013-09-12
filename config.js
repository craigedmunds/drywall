'use strict';

exports.port = process.env.PORT || 3030;
exports.mongodb = {
  uri: process.env.MONGO_URI || process.env.MONGOLAB_URI || process.env.MONGOHQ_URL
};
exports.companyName = 'Sell That';
exports.projectName = 'Sell That';
exports.systemEmail = process.env.SYSTEM_EMAIL;
exports.cryptoKey = process.env.CRYPTO_KEY;
exports.smtp = {
  from: {
    name: process.env.SMTP_FROM_NAME,
    address: process.env.SMTP_FROM_ADDRESS
  },
  credentials: {
    user: process.env.SMTP_USERNAME,
    password: process.env.SMTP_PASSWORD,
    host: process.env.SMTP_HOST,
    ssl: false
  }
};
exports.oauth = {
  twitter: {
    key: process.env.TWITTER_OAUTH_KEY,
    secret: process.env.TWITTER_OAUTH_SECRET
  },
  facebook: {
    key: process.env.FACEBOOK_OAUTH_KEY,
    secret: process.env.FACEBOOK_OAUTH_SECRET
  },
  github: {
    key: process.env.GITHUB_OAUTH_KEY,
    secret: process.env.GITHUB_OAUTH_SECRET
  },
  ebay: {
      devName: process.env.EBAY_DEV,
      cert: process.env.EBAY_CERT,
      appName: process.env.EBAY_APPNAME,
      sandbox: process.env.EBAY_SANDBOX,
      ruName: process.env.EBAY_RUNAME,
      ownertoken: process.env.EBAY_OWNERTOKEN,
    }
};
