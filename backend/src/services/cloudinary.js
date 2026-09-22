const config = require('../config');

const cloudinary = require('cloudinary').v2;

const upload = (file, folder) => new Promise((resolve, reject) => {
  if (!config.cloudinary.cloudName || !config.cloudinary.apiKey || !config.cloudinary.apiSecret) {
    return reject(new Error('Cloudinary is not configured for donation-drive files'));
  }
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret
  });
  const stream = cloudinary.uploader.upload_stream({ resource_type: 'auto', folder }, (error, result) => {
    if (error) return reject(error);
    resolve({
      provider: 'cloudinary',
      url: result.secure_url,
      secureUrl: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type,
      format: result.format,
      folder: result.folder || folder
    });
  });
  stream.end(file.buffer);
});

const remove = (publicId, resourceType = 'image') => new Promise((resolve, reject) => {
  if (!publicId) return resolve();
  cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true }, (error) => {
    if (error) return reject(error);
    resolve();
  });
});

module.exports = { upload, remove };
