module.exports = {
  apps: [{
    name: 'voice-conversation-app',
    script: '/usr/bin/serve',
    args: ['-s', 'build', '-l', '3000'],
    cwd: '/home/joris/voice-conversation-app',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};