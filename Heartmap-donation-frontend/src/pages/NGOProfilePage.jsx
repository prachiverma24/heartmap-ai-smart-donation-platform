import React, { useEffect, useState } from 'react';
import api from '../api';
import './AuthPage.css';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const defaultOperatingHours = {
  Monday: { open: '09:00', close: '17:00', closed: false },
  Tuesday: { open: '09:00', close: '17:00', closed: false },
  Wednesday: { open: '09:00', close: '17:00', closed: false },
  Thursday: { open: '09:00', close: '17:00', closed: false },
  Friday: { open: '09:00', close: '17:00', closed: false },
  Saturday: { open: '10:00', close: '14:00', closed: false },
  Sunday: { open: '', close: '', closed: true }
};

const parseOperatingHours = (raw) => {
  const result = { ...defaultOperatingHours };
  if (!raw || typeof raw !== 'object') return result;
  DAYS_OF_WEEK.forEach((day) => {
    const val = raw[day];
    if (!val) return;
    if (typeof val === 'object') {
      result[day] = {
        open: val.open || '',
        close: val.close || '',
        closed: Boolean(val.closed)
      };
    } else if (typeof val === 'string') {
      if (val.toLowerCase() === 'closed') {
        result[day] = { open: '', close: '', closed: true };
      } else {
        const parts = val.split('-').map((s) => s.trim());
        result[day] = {
          open: parts[0] || '09:00',
          close: parts[1] || '17:00',
          closed: false
        };
      }
    }
  });
  return result;
};

const emptyForm = {
  name: '', description: '', category: '', address: '', city: '', state: '', latitude: '', longitude: '', phone: '', email: '', website: '', officialDonationUrl: '', logo: '', images: '', acceptedDonationTypes: '', notAcceptedDonationTypes: '', urgentlyNeededItems: '', pickupAvailable: false, dropOffAvailable: false, pickupAreas: '', registrationInformation: '', verificationInformation: ''
};
const listValue = (value) => value.split(',').map((item) => item.trim()).filter(Boolean);

const NGOProfilePage = () => {
  const [form, setForm] = useState(emptyForm);
  const [operatingHours, setOperatingHours] = useState(defaultOperatingHours);
  const [profileId, setProfileId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    api.get('/ngo/profile').then(({ data }) => {
      if (!data.profile) return;
      const profile = data.profile;
      setProfileId(profile._id);
      setForm({ ...emptyForm, ...profile, name: profile.name || profile.organizationName || '', latitude: profile.latitude ?? profile.location?.lat ?? '', longitude: profile.longitude ?? profile.location?.lng ?? '', images: profile.images?.join(', ') || '', acceptedDonationTypes: profile.acceptedDonationTypes?.join(', ') || '', notAcceptedDonationTypes: profile.notAcceptedDonationTypes?.join(', ') || '', urgentlyNeededItems: profile.urgentlyNeededItems?.join(', ') || '', pickupAreas: profile.pickupAreas?.join(', ') || '', operatingHours: JSON.stringify(profile.operatingHours || {}, null, 2) });
      setForm({ ...emptyForm, ...profile, name: profile.name || profile.organizationName || '', latitude: profile.latitude ?? profile.location?.lat ?? '', longitude: profile.longitude ?? profile.location?.lng ?? '', images: profile.images?.join(', ') || '', acceptedDonationTypes: profile.acceptedDonationTypes?.join(', ') || '', notAcceptedDonationTypes: profile.notAcceptedDonationTypes?.join(', ') || '', urgentlyNeededItems: profile.urgentlyNeededItems?.join(', ') || '', pickupAreas: profile.pickupAreas?.join(', ') || '' });
      if (profile.operatingHours) {
        setOperatingHours(parseOperatingHours(profile.operatingHours));
      }
    }).catch((requestError) => setError(requestError.response?.data?.error || 'Unable to load your NGO profile.')).finally(() => setIsLoading(false));
  }, []);

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value });
  const updateOperatingHour = (day, field, value) => {
    setOperatingHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };
  const uploadFile = async (event, purpose) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(''); setUploading(true);
    try {
      const data = new FormData(); data.append('file', file); data.append('purpose', purpose);
      const response = await api.post('/uploads', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (purpose === 'logo') setForm((current) => ({ ...current, logo: response.data.file.url }));
      else if (purpose === 'activity-image') setForm((current) => ({ ...current, images: [current.images, response.data.file.url].filter(Boolean).join(', ') }));
      setMessage('File uploaded. Save the profile to keep the change.');
    } catch (requestError) { setError(requestError.response?.data?.error || 'Upload failed. Use a JPG, PNG, WebP, or PDF up to 5 MB.'); }
    finally { setUploading(false); event.target.value = ''; }
  };
  const submit = async (event) => {
    event.preventDefault(); setMessage(''); setError('');
    let operatingHours;
    try { operatingHours = JSON.parse(form.operatingHours || '{}'); } catch (parseError) { setError('Operating hours must be valid JSON.'); return; }
    if (!form.name.trim() || !form.city.trim() || !form.category.trim()) { setError('Name, category, and city are required.'); return; }
    try {
      const response = await api.put('/ngo/profile', { ...form, organizationName: form.name, latitude: Number(form.latitude), longitude: Number(form.longitude), images: listValue(form.images), acceptedDonationTypes: listValue(form.acceptedDonationTypes), notAcceptedDonationTypes: listValue(form.notAcceptedDonationTypes), urgentlyNeededItems: listValue(form.urgentlyNeededItems), pickupAreas: listValue(form.pickupAreas), operatingHours });
      if (response.data.profile) {
        setProfileId(response.data.profile._id);
      }
      setMessage('Profile saved. Verification status is managed by HeartMap administrators.');
    } catch (requestError) { setError(requestError.response?.data?.error || 'Unable to save your profile.'); }
  };

  const handleDelete = async () => {
    if (!profileId) return;
    const confirmed = window.confirm('Are you sure you want to delete your NGO profile? This action will permanently remove your organization listing and cannot be undone.');
    if (!confirmed) return;

    setIsDeleting(true); setMessage(''); setError('');
    try {
      await api.delete(`/ngo/${profileId}`);
      setProfileId('');
      setForm(emptyForm);
      setOperatingHours(defaultOperatingHours);
      setMessage('Your NGO profile has been permanently deleted.');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to delete your NGO profile.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) return <main className="auth-page"><div className="route-loading">Loading your NGO profile...</div></main>;
  return (
    <main className="auth-page"><section className="auth-panel ngo-editor"><p className="eyebrow">NGO MANAGEMENT</p><h1>Manage your organization</h1><p>Keep your public donation information clear and current. Verification status cannot be self-assigned.</p>{message && <div className="auth-error success-message">{message}</div>}{error && <div className="auth-error" role="alert">{error}</div>}
      <form className="auth-form" onSubmit={submit}>
        <label>NGO name<input name="name" value={form.name} onChange={update} required /></label><label>Description<textarea name="description" value={form.description} onChange={update} rows="4" /></label><label>Category<input name="category" value={form.category} onChange={update} required placeholder="Food, education, shelter" /></label><label>Address<input name="address" value={form.address} onChange={update} /></label>
        <div className="ngo-form-row"><label>City<input name="city" value={form.city} onChange={update} required /></label><label>State<input name="state" value={form.state} onChange={update} /></label></div><div className="ngo-form-row"><label>Latitude<input name="latitude" type="number" step="any" value={form.latitude} onChange={update} /></label><label>Longitude<input name="longitude" type="number" step="any" value={form.longitude} onChange={update} /></label></div><div className="ngo-form-row"><label>Phone<input name="phone" value={form.phone} onChange={update} /></label><label>Email<input name="email" type="email" value={form.email} onChange={update} /></label></div>
        <label>Website<input name="website" type="url" value={form.website} onChange={update} placeholder="https://" /></label><label>Official donation URL<input name="officialDonationUrl" type="url" value={form.officialDonationUrl} onChange={update} placeholder="https://" /></label><label>Logo URL<input name="logo" type="url" value={form.logo} onChange={update} /></label><label>Upload logo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => uploadFile(event, 'logo')} disabled={uploading} /></label><label>Photo URLs, comma separated<input name="images" value={form.images} onChange={update} /></label><label>Upload activity photograph<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => uploadFile(event, 'activity-image')} disabled={uploading} /></label>
        <label>Currently accepting<input name="acceptedDonationTypes" value={form.acceptedDonationTypes} onChange={update} placeholder="Food, Clothes, Books" /></label><label>Not accepting<input name="notAcceptedDonationTypes" value={form.notAcceptedDonationTypes} onChange={update} placeholder="Broken electronics, opened food" /></label><label>Urgently needed<input name="urgentlyNeededItems" value={form.urgentlyNeededItems} onChange={update} placeholder="Blankets, winter clothes" /></label><label>Pickup areas, comma separated<input name="pickupAreas" value={form.pickupAreas} onChange={update} /></label>
        <div className="ngo-checks"><label><input name="pickupAvailable" type="checkbox" checked={form.pickupAvailable} onChange={update} /> Pickup available</label><label><input name="dropOffAvailable" type="checkbox" checked={form.dropOffAvailable} onChange={update} /> Drop-off available</label></div><label>Operating hours JSON<textarea name="operatingHours" value={form.operatingHours} onChange={update} rows="4" /></label><label>Registration information<textarea name="registrationInformation" value={form.registrationInformation} onChange={update} rows="3" placeholder="Registration number, authority, and date" /></label><label>Verification information<textarea name="verificationInformation" value={form.verificationInformation} onChange={update} rows="3" placeholder="Information for admin review" /></label><label>Verification document<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => uploadFile(event, 'verification-document')} disabled={uploading} /></label>
        <div className="ngo-checks"><label><input name="pickupAvailable" type="checkbox" checked={form.pickupAvailable} onChange={update} /> Pickup available</label><label><input name="dropOffAvailable" type="checkbox" checked={form.dropOffAvailable} onChange={update} /> Drop-off available</label></div>
        <div className="ngo-operating-hours-editor">
          <span className="section-subtitle">Operating Hours & Timings</span>
          <div className="hours-grid">
            {DAYS_OF_WEEK.map((day) => {
              const config = operatingHours[day] || { open: '', close: '', closed: false };
              return (
                <div className="hours-day-row" key={day}>
                  <span className="day-name">{day}</span>
                  <label className="closed-toggle">
                    <input
                      type="checkbox"
                      checked={config.closed}
                      onChange={(e) => updateOperatingHour(day, 'closed', e.target.checked)}
                    />
                    Closed
                  </label>
                  {!config.closed && (
                    <div className="time-inputs">
                      <input
                        type="time"
                        value={config.open || '09:00'}
                        onChange={(e) => updateOperatingHour(day, 'open', e.target.value)}
                        aria-label={`${day} opening time`}
                      />
                      <span>to</span>
                      <input
                        type="time"
                        value={config.close || '17:00'}
                        onChange={(e) => updateOperatingHour(day, 'close', e.target.value)}
                        aria-label={`${day} closing time`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <label>Registration information<textarea name="registrationInformation" value={form.registrationInformation} onChange={update} rows="3" placeholder="Registration number, authority, and date" /></label><label>Verification information<textarea name="verificationInformation" value={form.verificationInformation} onChange={update} rows="3" placeholder="Information for admin review" /></label><label>Verification document<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => uploadFile(event, 'verification-document')} disabled={uploading} /></label>
        <div className="ngo-actions-row">
          <button type="submit" disabled={uploading || isDeleting}>{uploading ? 'Uploading...' : 'Save profile'}</button>
          {profileId && (
            <button
              type="button"
              className="btn-danger-delete"
              onClick={handleDelete}
              disabled={uploading || isDeleting}
            >
              {isDeleting ? 'Deleting NGO...' : 'Delete NGO profile'}
            </button>
          )}
        </div>
      </form>
    </section></main>
  );
};

export default NGOProfilePage;
