import React, { useState } from 'react';
import api from '../api';

const FileUploadField = ({ purpose, value, onChange, label }) => {
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(''); setIsUploading(true);
    try {
      const data = new FormData(); data.append('file', file); data.append('purpose', purpose);
      const response = await api.post('/uploads', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      onChange([...(value || []), response.data.file.url]);
    } catch (requestError) { setError(requestError.response?.data?.error || 'Upload failed. Use an image up to 5 MB.'); }
    finally { setIsUploading(false); event.target.value = ''; }
  };

  return <label>{label}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} disabled={isUploading} />{isUploading && <small>Uploading...</small>}{error && <small className="support-error">{error}</small>}{value?.length > 0 && <small>{value.length} image{value.length === 1 ? '' : 's'} attached</small>}</label>;
};

export default FileUploadField;
