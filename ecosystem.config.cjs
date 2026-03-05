module.exports = {
  apps: [{
    name: 'hok-api',
    script: 'src/serve-api.js',
    interpreter: 'node',
    interpreter_args: '--experimental-vm-modules',
    env: {
      NODE_ENV: 'production',
      RESEND_API_KEY: 're_UotSwNdy_2RMGCW7HViVGoAhumxU3FFrF',
      FROM_EMAIL: 'HOK Hub <noreply@hok-hub.project-n.site>',
      ADMIN_EMAIL: 'Lisvindanu015@gmail.com'
    }
  }]
};
