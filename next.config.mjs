const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // This is needed for the TensorFlow.js and handpose models to work properly
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
    };
    return config;
  },
};

export default nextConfig;

