module.exports = {
  apps: [
    {
      name: "coinrisqlab-front",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      cwd: "/home/ubuntu/coinrisqlab/coinrisqlab/coinrisqlab-front",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
