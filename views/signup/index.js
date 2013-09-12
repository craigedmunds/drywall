'use strict';
var debug = require('debug')('drywall:views:signup:index')
  , util = require('util')
  ;

exports.init = function(req, res){
  if (req.isAuthenticated()) { 
    res.redirect(req.user.defaultReturnUrl());
  }
  else {
    res.render('signup/index', {
      oauthMessage: '',
      oauthTwitter: !!req.app.get('twitter-oauth-key'),
      oauthGitHub: !!req.app.get('github-oauth-key'),
      oauthFacebook: !!req.app.get('facebook-oauth-key'),
      oauthEbay: !!req.app.get('ebay-auth-devName')
    });
  }
};

exports.signup = function(req, res){
  var workflow = req.app.utility.workflow(req, res);
  
  workflow.on('validate', function() {
    if (!req.body.username) {
      workflow.outcome.errfor.username = 'required';
    }
    else if (!/^[a-zA-Z0-9\-\_]+$/.test(req.body.username)) {
      workflow.outcome.errfor.username = 'only use letters, numbers, \'-\', \'_\'';
    }
    
    if (!req.body.email) {
      workflow.outcome.errfor.email = 'required';
    }
    else if (!/^[a-zA-Z0-9\-\_\.\+]+@[a-zA-Z0-9\-\_\.]+\.[a-zA-Z0-9\-\_]+$/.test(req.body.email)) {
      workflow.outcome.errfor.email = 'invalid email format';
    }
    
    if (!req.body.password) {
      workflow.outcome.errfor.password = 'required';
    }
    
    if (workflow.hasErrors()) {
      return workflow.emit('response');
    }
    
    workflow.emit('duplicateUsernameCheck');
  });
  
  workflow.on('duplicateUsernameCheck', function() {
    req.app.db.models.User.findOne({ username: req.body.username }, function(err, user) {
      if (err) {
        return workflow.emit('exception', err);
      }
      
      if (user) {
        workflow.outcome.errfor.username = 'username already taken';
        return workflow.emit('response');
      }
      
      workflow.emit('duplicateEmailCheck');
    });
  });
  
  workflow.on('duplicateEmailCheck', function() {
    req.app.db.models.User.findOne({ email: req.body.email }, function(err, user) {
      if (err) {
        return workflow.emit('exception', err);
      }
      
      if (user) {
        workflow.outcome.errfor.email = 'email already registered';
        return workflow.emit('response');
      }
      
      workflow.emit('createUser');
    });
  });
  
  workflow.on('createUser', function() {
    var fieldsToSet = {
      isActive: 'yes',
      username: req.body.username,
      email: req.body.email,
      password: req.app.db.models.User.encryptPassword(req.body.password),
      search: [
        req.body.username,
        req.body.email
      ]
    };
    req.app.db.models.User.create(fieldsToSet, function(err, user) {
      if (err) {
        return workflow.emit('exception', err);
      }
      
      workflow.user = user;
      workflow.emit('createAccount');
    });
  });
  
  workflow.on('createAccount', function() {
    var fieldsToSet = {
      isVerified: req.app.get('require-account-verification') ? 'no' : 'yes',
      'name.full': workflow.user.username,
      user: {
        id: workflow.user._id,
        name: workflow.user.username
      },
      search: [
        workflow.user.username
      ]
    };
    
    req.app.db.models.Account.create(fieldsToSet, function(err, account) {
      if (err) {
        return workflow.emit('exception', err);
      }
      
      //update user with account
      workflow.user.roles.account = account._id;
      workflow.user.save(function(err, user) {
        if (err) {
          return workflow.emit('exception', err);
        }
        
        workflow.emit('sendWelcomeEmail');
      });
    });
  });
  
  workflow.on('sendWelcomeEmail', function() {
    req.app.utility.sendmail(req, res, {
      from: req.app.get('smtp-from-name') +' <'+ req.app.get('smtp-from-address') +'>',
      to: req.body.email,
      subject: 'Your '+ req.app.get('project-name') +' Account',
      textPath: 'signup/email-text',
      htmlPath: 'signup/email-html',
      locals: {
        username: req.body.username,
        email: req.body.email,
        loginURL: 'http://'+ req.headers.host +'/login/',
        projectName: req.app.get('project-name')
      },
      success: function(message) {
        workflow.emit('logUserIn');
      },
      error: function(err) {
        console.log('Error Sending Welcome Email: '+ err);
        workflow.emit('logUserIn');
      }
    });
  });
  
  workflow.on('logUserIn', function() {
    req._passport.instance.authenticate('local', function(err, user, info) {
      if (err) {
        return workflow.emit('exception', err);
      }
      
      if (!user) {
        workflow.outcome.errors.push('Login failed. That is strange.');
        return workflow.emit('response');
      }
      else {
        req.login(user, function(err) {
          if (err) {
            return workflow.emit('exception', err);
          }
          
          workflow.outcome.defaultReturnUrl = user.defaultReturnUrl();
          workflow.emit('response');
        });
      }
    })(req, res);
  });
  
  workflow.emit('validate');
};



exports.signupTwitter = function(req, res, next) {
  req._passport.instance.authenticate('twitter', function(err, user, info) {
    if (!info || !info.profile) {
      return res.redirect('/signup/');
    }
    
    req.app.db.models.User.findOne({ 'twitter.id': info.profile.id }, function(err, user) {
      if (err) {
        return next(err);
      }
      
      if (!user) {
        req.session.socialProfile = info.profile;
        res.render('signup/social', { email: '' });
      }
      else {
        res.render('signup/index', {
          oauthMessage: 'We found a user linked to your Twitter account.',
          oauthTwitter: !!req.app.get('twitter-oauth-key'),
          oauthGitHub: !!req.app.get('github-oauth-key'),
          oauthFacebook: !!req.app.get('facebook-oauth-key'),
          oauthEbay: !!req.app.get('ebay-auth-devName')
        });
      }
    });
  })(req, res, next);
};

exports.signupEbay = function(req, res, next) {
  debug("signupEbay");

  req._passport.instance.authenticate('ebay', function(err, user, info) {
    
    debug("signupEbay authenticated, err : %s, user : %s, info : %s", err, user, info);
  
    if (!info || !info.profile) {
      debug("signupEbay no profile found, redirecting to signup");
      return res.redirect('/signup/');
    }
    
    debug("signupEbay finding user %s", info.profile.username);
    req.app.db.models.User.findOne({ 'ebay.UserID': info.profile.username }, function(err, user) {

      if (err) {
        debug("signupEbay find user error %s", err);
        return next(err);
      }
      
      if (!user) {
        debug("signupEbay find user no user found");

        req.session.socialProfile = info.profile;
        res.render('signup/social', { email: info.profile.email });
      }
      else {
        debug("signupEbay user found - login");

        req.login(user, function(err) {
          if (err) {
            throw err;
          }

          debug("signupEbay checking roles to redirect : %s", req.user.roles);

          delete req.session.socialProfile;
          
          return res.redirect('/admin/');

          // if (req.user.roles.admin.isMemberOf('root'))
          //   return res.redirect('/admin/');
          // else
          //   return res.redirect('/');
          
        });
      }
    });
  })(req, res, next);
};

exports.signupGitHub = function(req, res, next) {
  req._passport.instance.authenticate('github', function(err, user, info) {
    if (!info || !info.profile) {
      return res.redirect('/signup/');
    }
    
    req.app.db.models.User.findOne({ 'github.id': info.profile.id }, function(err, user) {
      if (err) {
        return next(err);
      }
      
      if (!user) {
        req.session.socialProfile = info.profile;
        res.render('signup/social', { email: info.profile.emails[0].value || '' });
      }
      else {
        req.login(user, function(err) {
          if (err) {
            return next(err);
          }
          
          res.redirect(user.defaultReturnUrl());
        });
      }
    });
  })(req, res, next);
};

exports.signupFacebook = function(req, res, next) {
  req._passport.instance.authenticate('facebook', { callbackURL: '/signup/facebook/callback/' }, function(err, user, info) {
    if (!info || !info.profile) {
      return res.redirect('/signup/');
    }
    
    req.app.db.models.User.findOne({ 'facebook.id': info.profile.id }, function(err, user) {
      if (err) {
        return next(err);
      }
      
      if (!user) {
        req.session.socialProfile = info.profile;
        res.render('signup/social', { email: info.profile.emails[0].value || '' });
      }
      else {
        res.render('signup/index', {
          oauthMessage: 'We found a user linked to your Facebook account.',
          oauthTwitter: !!req.app.get('twitter-oauth-key'),
          oauthGitHub: !!req.app.get('github-oauth-key'),
          oauthFacebook: !!req.app.get('facebook-oauth-key'),
          oauthEbay: !!req.app.get('ebay-auth-devName')
        });
      }
    });
  })(req, res, next);
};

exports.signupSocial = function(req, res){
  var workflow = req.app.utility.workflow(req, res);
  
  workflow.on('validate', function() {
    debug("workflow validate");
    if (!req.body.email) {
      workflow.outcome.errfor.email = 'required';
    }
    else if (!/^[a-zA-Z0-9\-\_\.\+]+@[a-zA-Z0-9\-\_\.]+\.[a-zA-Z0-9\-\_]+$/.test(req.body.email)) {
      workflow.outcome.errfor.email = 'invalid email format';
    }
    
    if (workflow.hasErrors()) {
      return workflow.emit('response');
    }
    
    workflow.emit('duplicateUsernameCheck');
  });
  
  workflow.on('duplicateUsernameCheck', function() {
    debug("workflow duplicateUsernameCheck");
    workflow.username = req.session.socialProfile.username;
    if (!/^[a-zA-Z0-9\-\_]+$/.test(workflow.username)) {
      workflow.username = workflow.username.replace(/[^a-zA-Z0-9\-\_]/g, '');
    }
    
    req.app.db.models.User.findOne({ username: workflow.username }, function(err, user) {
      if (err) {
        return workflow.emit('exception', err);
      }
      
      if (user) {
        workflow.username = workflow.username + req.session.socialProfile.id;
      }
      else {
        workflow.username = workflow.username;
      }
      
      workflow.emit('duplicateEmailCheck');
    });
  });
  
  workflow.on('duplicateEmailCheck', function() {
    debug("workflow duplicateEmailCheck");
    req.app.db.models.User.findOne({ email: req.body.email }, function(err, user) {
      if (err) {
        return workflow.emit('exception', err);
      }
      
      if (user) {
        workflow.user = user;
        // workflow.outcome.errfor.email = 'email already registered';
        workflow.emit('updateUser');
      }
      else {
        workflow.emit('createUser');
      }
    });
  });
  
  workflow.on('updateUser', function() {
    
    debug("workflow updateUser req.session.socialProfile.provider : %s, req.session.socialProfile._json %s",
      req.session.socialProfile.provider, util.inspect(req.session.socialProfile._json));

    var tmpUser = workflow.user;

    var user = {
      isActive: 'yes',
      username: tmpUser.username,
      email: tmpUser.email,
      search: tmpUser.search
    };

    user[req.session.socialProfile.provider] = req.session.socialProfile._json;
    
    debug("workflow updateUser updating user user %s", util.inspect(user));

    req.app.db.models.User.update({ email: user.email }, user, function(err) {
      if (err) {
        return workflow.emit('exception', err);
      }
      
      workflow.emit('logUserIn');
    });
  });
  
  workflow.on('createUser', function() {
    var fieldsToSet = {
      isActive: 'yes',
      username: workflow.username,
      email: req.body.email,
      search: [
        workflow.username,
        req.body.email
      ]
    };

    debug("workflow createUser req.session.socialProfile.provider : %s, req.session.socialProfile._json %s",
      req.session.socialProfile.provider, util.inspect(req.session.socialProfile._json));

    fieldsToSet[req.session.socialProfile.provider] = req.session.socialProfile._json;
    
    debug("workflow createUser creating user fieldsToSet %s", util.inspect(fieldsToSet));

    req.app.db.models.User.create(fieldsToSet, function(err, user) {
      if (err) {
        return workflow.emit('exception', err);
      }
      
      workflow.user = user;
      workflow.emit('createAccount');
    });
  });
  
  workflow.on('createAccount', function() {
    debug("workflow createAccount req.session.socialProfile : %s", req.session.socialProfile);

    var nameParts = req.session.socialProfile.displayName.split(' ');
    var fieldsToSet = {
      isVerified: 'yes',
      'name.first': nameParts[0],
      'name.last': nameParts[1] || '',
      'name.full': req.session.socialProfile.displayName,
      user: {
        id: workflow.user._id,
        name: workflow.user.username
      },
      search: [
        nameParts[0],
        nameParts[1] || ''
      ]
    };
    req.app.db.models.Account.create(fieldsToSet, function(err, account) {
      if (err) {
        return workflow.emit('exception', err);
      }
      
      //update user with account
      workflow.user.roles.account = account._id;
      workflow.user.save(function(err, user) {
        if (err) {
          return workflow.emit('exception', err);
        }
        
        workflow.emit('sendWelcomeEmail');
      });
    });
  });
  
  workflow.on('sendWelcomeEmail', function() {
    debug("workflow sendWelcomeEmail");
    req.app.utility.sendmail(req, res, {
      from: req.app.get('smtp-from-name') +' <'+ req.app.get('smtp-from-address') +'>',
      to: req.body.email,
      subject: 'Your '+ req.app.get('project-name') +' Account',
      textPath: 'signup/email-text',
      htmlPath: 'signup/email-html',
      locals: {
        username: workflow.user.username,
        email: req.body.email,
        loginURL: 'http://'+ req.headers.host +'/login/',
        projectName: req.app.get('project-name')
      },
      success: function(message) {
        workflow.emit('logUserIn');
      },
      error: function(err) {
        console.log('Error Sending Welcome Email: '+ err);
        workflow.emit('logUserIn');
      }
    });
  });
  
  workflow.on('logUserIn', function() {
    debug("workflow logUserIn");
    req.login(workflow.user, function(err) {
      if (err) {
        return workflow.emit('exception', err);
      }
      
      delete req.session.socialProfile;
      workflow.outcome.defaultReturnUrl = workflow.user.defaultReturnUrl();
      workflow.emit('response');
    });
  });
  
  workflow.emit('validate');
};
