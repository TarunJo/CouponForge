import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function AdminDashboard() {
  const [merchants, setMerchants] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editMerchant, setEditMerchant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    merchant_number: '', org_name: '', name: '', email: '', phone: '', password: '', address: ''
  });

  const { user, logout, apiFetch } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchMerchants();
  }, []);

  const fetchMerchants = async () => {
    try {
      const data = await apiFetch('/admin/merchants');
      setMerchants(data.merchants);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editMerchant) {
        await apiFetch(`/admin/merchants/${editMerchant.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
        toast.success('Merchant updated successfully');
      } else {
        await apiFetch('/admin/merchants', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
        toast.success('Merchant created successfully');
      }
      setShowModal(false);
      setEditMerchant(null);
      resetForm();
      fetchMerchants();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleEdit = (merchant) => {
    setEditMerchant(merchant);
    setFormData({
      merchant_number: merchant.merchant_number,
      org_name: merchant.org_name,
      name: merchant.name,
      email: merchant.email,
      phone: merchant.phone || '',
      password: '',
      address: merchant.address || '',
    });
    setShowModal(true);
  };

  const handleToggleActive = async (merchant) => {
    try {
      if (merchant.is_active) {
        await apiFetch(`/admin/merchants/${merchant.id}`, { method: 'DELETE' });
        toast.success('Merchant deactivated');
      } else {
        await apiFetch(`/admin/merchants/${merchant.id}`, {
          method: 'PUT',
          body: JSON.stringify({ is_active: true }),
        });
        toast.success('Merchant activated');
      }
      fetchMerchants();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const resetForm = () => {
    setFormData({ merchant_number: '', org_name: '', name: '', email: '', phone: '', password: '', address: '' });
  };

  const openCreateModal = () => {
    setEditMerchant(null);
    resetForm();
    setShowModal(true);
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">🛡️</div>
          <h2>CouponForge</h2>
        </div>
        <nav className="sidebar-nav">
          <button className="nav-link active">
            <span className="nav-icon">👥</span>
            Merchants
          </button>
        </nav>
        <div className="sidebar-footer">
          <div style={{ padding: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Logged in as</div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user.username}</div>
          </div>
          <button className="nav-link" onClick={async () => { await logout(); navigate('/login/admin', { replace: true }); }}>
            <span className="nav-icon">🚪</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="page-header">
          <h1>👥 Merchant Management</h1>
          <p>Create and manage merchant accounts for your organization</p>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card animate-in">
            <div className="stat-icon">🏪</div>
            <div className="stat-value">{merchants.length}</div>
            <div className="stat-label">Total Merchants</div>
          </div>
          <div className="stat-card animate-in" style={{ animationDelay: '0.1s' }}>
            <div className="stat-icon">✅</div>
            <div className="stat-value">{merchants.filter(m => m.is_active).length}</div>
            <div className="stat-label">Active</div>
          </div>
          <div className="stat-card animate-in" style={{ animationDelay: '0.2s' }}>
            <div className="stat-icon">⏸️</div>
            <div className="stat-value">{merchants.filter(m => !m.is_active).length}</div>
            <div className="stat-label">Inactive</div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="toolbar">
          <div></div>
          <button id="create-merchant-btn" className="btn btn-primary" onClick={openCreateModal}>
            ➕ Create Merchant
          </button>
        </div>

        {/* Merchants Table */}
        {loading ? (
          <div className="loading-page"><div className="spinner"></div></div>
        ) : merchants.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏪</div>
            <h3>No merchants yet</h3>
            <p>Create your first merchant account to get started</p>
            <button className="btn btn-primary" onClick={openCreateModal}>
              ➕ Create Merchant
            </button>
          </div>
        ) : (
          <div className="table-container animate-in">
            <table className="table">
              <thead>
                <tr>
                  <th>Merchant #</th>
                  <th>Organization</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {merchants.map(merchant => (
                  <tr key={merchant.id}>
                    <td><strong>{merchant.merchant_number}</strong></td>
                    <td>{merchant.org_name}</td>
                    <td>{merchant.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{merchant.email}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{merchant.phone || '—'}</td>
                    <td>
                      <span className={`badge ${merchant.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {merchant.is_active ? '● Active' : '● Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="btn-group">
                        <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(merchant)}>
                          ✏️ Edit
                        </button>
                        <button
                          className={`btn btn-sm ${merchant.is_active ? 'btn-danger' : 'btn-success'}`}
                          onClick={() => handleToggleActive(merchant)}
                        >
                          {merchant.is_active ? '⏸️ Deactivate' : '▶️ Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Create/Edit Merchant Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editMerchant ? '✏️ Edit Merchant' : '➕ New Merchant'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {!editMerchant && (
                  <div className="form-group">
                    <label className="form-label">Merchant Number *</label>
                    <input
                      name="merchant_number"
                      className="form-input"
                      placeholder="e.g. MER-001"
                      value={formData.merchant_number}
                      onChange={handleChange}
                      required
                    />
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Organization Name *</label>
                    <input
                      name="org_name"
                      className="form-input"
                      placeholder="e.g. Acme Corp"
                      value={formData.org_name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Contact Name *</label>
                    <input
                      name="name"
                      className="form-input"
                      placeholder="e.g. John Doe"
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input
                      name="email"
                      type="email"
                      className="form-input"
                      placeholder="merchant@email.com"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      name="phone"
                      className="form-input"
                      placeholder="+91 9876543210"
                      value={formData.phone}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Password {editMerchant ? '(leave blank to keep current)' : '*'}
                  </label>
                  <input
                    name="password"
                    type="password"
                    className="form-input"
                    placeholder={editMerchant ? 'Leave blank to keep current' : 'Set merchant password'}
                    value={formData.password}
                    onChange={handleChange}
                    required={!editMerchant}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <textarea
                    name="address"
                    className="form-textarea"
                    placeholder="Business address"
                    value={formData.address}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editMerchant ? '💾 Update Merchant' : '➕ Create Merchant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
