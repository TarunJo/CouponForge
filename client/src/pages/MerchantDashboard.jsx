import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function MerchantDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(null);
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [validateResult, setValidateResult] = useState(null);
  const [validating, setValidating] = useState(false);
  const [validateInput, setValidateInput] = useState('');
  const [couponFilter, setCouponFilter] = useState('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    amount: '', description: '', customer_name: '', customer_phone: '', expires_in_days: '0', currency: 'INR'
  });

  const { user, logout, apiFetch } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsData, couponsData] = await Promise.all([
        apiFetch('/merchant/dashboard'),
        apiFetch('/merchant/coupons'),
      ]);
      setStats(statsData.stats);
      setCoupons(couponsData.coupons);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...createForm,
        amount: parseFloat(createForm.amount),
        expires_in_days: createForm.expires_in_days === '0' ? null : parseInt(createForm.expires_in_days),
      };
      await apiFetch('/merchant/coupons', { method: 'POST', body: JSON.stringify(payload) });
      toast.success('Coupon created successfully!');
      setShowCreateModal(false);
      setCreateForm({ amount: '', description: '', customer_name: '', customer_phone: '', expires_in_days: '0', currency: 'INR' });
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleValidate = async (e) => {
    e.preventDefault();
    setValidating(true);
    setValidateResult(null);
    try {
      const isUuid = validateInput.includes('-');
      const payload = isUuid ? { uuid: validateInput } : { validation_code: validateInput.toUpperCase() };
      const data = await apiFetch('/merchant/coupons/validate', { method: 'POST', body: JSON.stringify(payload) });
      setValidateResult(data);
    } catch (err) {
      setValidateResult({ valid: false, error: err.message });
    } finally {
      setValidating(false);
    }
  };

  const handleRedeem = async (uuid) => {
    try {
      await apiFetch('/merchant/coupons/redeem', { method: 'POST', body: JSON.stringify({ uuid }) });
      toast.success('Coupon redeemed and cleared from system!');
      setValidateResult(null);
      setValidateInput('');
      setShowValidateModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteCoupon = async (id) => {
    if (!confirm('Delete this coupon?')) return;
    try {
      await apiFetch(`/merchant/coupons/${id}`, { method: 'DELETE' });
      toast.success('Coupon deleted');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const getCouponLink = (uuid) => `${window.location.origin}/coupon/${uuid}`;

  const shareWhatsApp = (coupon) => {
    const link = getCouponLink(coupon.uuid);
    const msg = `🎉 You've received a coupon${coupon.customer_name ? ` for ${coupon.customer_name}` : ''}!\n\n🏪 From: ${user.org_name}\n💰 Scratch to reveal your reward!\n${coupon.description ? `📝 ${coupon.description}\n` : ''}\n👉 ${link}`;
    window.open(`https://wa.me/${coupon.customer_phone || ''}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const shareSMS = (coupon) => {
    const link = getCouponLink(coupon.uuid);
    const msg = `You've received a coupon from ${user.org_name}! Scratch to reveal: ${link}`;
    window.open(`sms:${coupon.customer_phone || ''}?body=${encodeURIComponent(msg)}`, '_blank');
  };

  const copyLink = (uuid) => {
    navigator.clipboard.writeText(getCouponLink(uuid));
    toast.success('Link copied to clipboard!');
  };

  const filteredCoupons = coupons.filter(c => {
    if (couponFilter === 'active') return !c.is_scratched && !c.is_redeemed;
    if (couponFilter === 'scratched') return c.is_scratched && !c.is_redeemed;
    if (couponFilter === 'redeemed') return c.is_redeemed;
    return true;
  });

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const formatCurrency = (amount, currency = 'INR') => {
    const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
    return `${symbols[currency] || currency} ${Number(amount).toLocaleString('en-IN')}`;
  };

  const isExpired = (expiresAt) => expiresAt && new Date(expiresAt) < new Date();

  if (!user || user.role !== 'merchant') return null;

  return (
    <>
      {/* Mobile Header */}
      <div className="mobile-header">
        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
        <span style={{ fontWeight: 600 }}>CouponForge</span>
        <div style={{ width: 40 }}></div>
      </div>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="app-layout">
        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-logo">
            <div className="logo-icon">🎫</div>
            <h2>CouponForge</h2>
          </div>
          <nav className="sidebar-nav">
            <button className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}>
              <span className="nav-icon">📊</span> Dashboard
            </button>
            <button className={`nav-link ${activeTab === 'coupons' ? 'active' : ''}`} onClick={() => { setActiveTab('coupons'); setSidebarOpen(false); }}>
              <span className="nav-icon">🎫</span> Coupons
            </button>
            <button className={`nav-link ${activeTab === 'validate' ? 'active' : ''}`} onClick={() => { setActiveTab('validate'); setSidebarOpen(false); }}>
              <span className="nav-icon">✅</span> Validate
            </button>
          </nav>
          <div className="sidebar-footer">
            <div style={{ padding: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ORGANIZATION</div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.15rem' }}>{user.org_name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{user.name}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>#{user.merchant_number}</div>
            </div>
            <button className="nav-link" onClick={async () => { await logout(); navigate('/login/merchant', { replace: true }); }}>
              <span className="nav-icon">🚪</span> Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {loading ? (
            <div className="loading-page"><div className="spinner"></div></div>
          ) : (
            <>
              {/* === DASHBOARD TAB === */}
              {activeTab === 'dashboard' && (
                <div className="animate-in">
                  <div className="page-header">
                    <h1>📊 Dashboard</h1>
                    <p>Welcome back, {user.name}! Here&apos;s your coupon overview.</p>
                  </div>

                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-icon">🎫</div>
                      <div className="stat-value">{stats?.total_coupons || 0}</div>
                      <div className="stat-label">Total Coupons</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon">⚡</div>
                      <div className="stat-value">{stats?.active_coupons || 0}</div>
                      <div className="stat-label">Active Coupons</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon">👆</div>
                      <div className="stat-value">{stats?.scratched_coupons || 0}</div>
                      <div className="stat-label">Scratched</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon">💰</div>
                      <div className="stat-value">{formatCurrency(stats?.active_amount || 0)}</div>
                      <div className="stat-label">Active Value</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary btn-lg" onClick={() => setShowCreateModal(true)}>
                      ➕ Create New Coupon
                    </button>
                    <button className="btn btn-success btn-lg" onClick={() => setActiveTab('validate')}>
                      ✅ Validate Coupon
                    </button>
                  </div>
                </div>
              )}

              {/* === COUPONS TAB === */}
              {activeTab === 'coupons' && (
                <div className="animate-in">
                  <div className="page-header">
                    <h1>🎫 My Coupons</h1>
                    <p>Manage, share, and track all your coupons</p>
                  </div>

                  <div className="toolbar">
                    <div className="tab-bar">
                      {['all', 'active', 'scratched'].map(f => (
                        <button key={f} className={`tab ${couponFilter === f ? 'active' : ''}`} onClick={() => setCouponFilter(f)}>
                          {f === 'all' ? `All (${coupons.length})` :
                           f === 'active' ? `Active (${coupons.filter(c => !c.is_scratched).length})` :
                           `Scratched (${coupons.filter(c => c.is_scratched && !c.is_redeemed).length})`}
                        </button>
                      ))}
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                      ➕ Create Coupon
                    </button>
                  </div>

                  {filteredCoupons.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">🎫</div>
                      <h3>No coupons found</h3>
                      <p>Create your first coupon and start sharing rewards!</p>
                      <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                        ➕ Create Coupon
                      </button>
                    </div>
                  ) : (
                    <div className="coupon-grid">
                      {filteredCoupons.map(coupon => (
                        <div key={coupon.id} className={`coupon-card ${coupon.is_scratched ? 'scratched' : 'active'}`}>
                          <div className="coupon-card-header">
                            <div className="coupon-amount">{formatCurrency(coupon.amount, coupon.currency)}</div>
                            <span className={`badge ${
                              isExpired(coupon.expires_at) ? 'badge-danger' :
                              coupon.is_scratched ? 'badge-warning' : 'badge-success'
                            }`}>
                              {isExpired(coupon.expires_at) ? '⏰ Expired' :
                               coupon.is_scratched ? '👆 Scratched' : '✨ Active'}
                            </span>
                          </div>
                          <div className="coupon-card-body">
                            {coupon.description && <p className="coupon-desc">{coupon.description}</p>}
                            <div className="coupon-meta">
                              {coupon.customer_name && <span>👤 {coupon.customer_name}</span>}
                              {coupon.customer_phone && <span>📱 {coupon.customer_phone}</span>}
                              <span>📅 {formatDate(coupon.created_at)}</span>
                              {coupon.expires_at && <span>⏰ Expires: {formatDate(coupon.expires_at)}</span>}
                            </div>
                            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              Code: <strong style={{ color: 'var(--primary-300)', letterSpacing: '0.1em' }}>{coupon.validation_code}</strong>
                            </div>
                          </div>
                          <div className="coupon-card-footer">
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowShareModal(coupon)}>
                              📤 Share
                            </button>
                            <button className="btn btn-sm btn-ghost" onClick={() => copyLink(coupon.uuid)}>
                              🔗 Copy Link
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteCoupon(coupon.id)}>
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* === VALIDATE TAB === */}
              {activeTab === 'validate' && (
                <div className="animate-in">
                  <div className="page-header">
                    <h1>✅ Validate Coupon</h1>
                    <p>Enter the validation code shown on the customer&apos;s coupon to verify authenticity</p>
                  </div>

                  <div className="validate-section">
                    <div className="card">
                      <form onSubmit={handleValidate}>
                        <div className="form-group">
                          <label className="form-label">Validation Code or Coupon UUID</label>
                          <input
                            className="form-input"
                            placeholder="Enter code (e.g. A1B2C3) or UUID"
                            value={validateInput}
                            onChange={e => setValidateInput(e.target.value)}
                            required
                            style={{ fontSize: '1.2rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}
                          />
                        </div>
                        <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={validating}>
                          {validating ? '⏳ Validating...' : '🔍 Validate Coupon'}
                        </button>
                      </form>
                    </div>

                    {validateResult && (
                      <div className={`validate-result ${validateResult.valid ? 'valid' : 'invalid'}`}>
                        {validateResult.valid ? (
                          <>
                            <h4>✅ Coupon is Valid!</h4>
                            <div className="detail-grid">
                              <div className="detail-item">
                                <div className="label">Amount</div>
                                <div className="value">{formatCurrency(validateResult.coupon.amount, validateResult.coupon.currency)}</div>
                              </div>
                              <div className="detail-item">
                                <div className="label">Customer</div>
                                <div className="value">{validateResult.coupon.customer_name || 'N/A'}</div>
                              </div>
                              <div className="detail-item">
                                <div className="label">Code</div>
                                <div className="value">{validateResult.coupon.validation_code}</div>
                              </div>
                              <div className="detail-item">
                                <div className="label">Created</div>
                                <div className="value">{formatDate(validateResult.coupon.created_at)}</div>
                              </div>
                            </div>
                            {validateResult.coupon.description && (
                              <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.15rem' }}>Description</div>
                                <div>{validateResult.coupon.description}</div>
                              </div>
                            )}
                            <button
                              className="btn btn-success btn-lg"
                              style={{ width: '100%', marginTop: '1rem' }}
                              onClick={() => handleRedeem(validateResult.coupon.uuid)}
                            >
                              ✅ Redeem & Clear Coupon
                            </button>
                          </>
                        ) : (
                          <h4>❌ {validateResult.error || 'Invalid Coupon'}</h4>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* === CREATE COUPON MODAL === */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>➕ Create Scratch Coupon</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateCoupon}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Amount *</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="e.g. 500"
                      value={createForm.amount}
                      onChange={e => setCreateForm(p => ({ ...p, amount: e.target.value }))}
                      required
                      min="1"
                      step="0.01"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Currency</label>
                    <select
                      className="form-select"
                      value={createForm.currency}
                      onChange={e => setCreateForm(p => ({ ...p, currency: e.target.value }))}
                    >
                      <option value="INR">₹ INR</option>
                      <option value="USD">$ USD</option>
                      <option value="EUR">€ EUR</option>
                      <option value="GBP">£ GBP</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    placeholder="e.g. Diwali special discount on electronics"
                    value={createForm.description}
                    onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Customer Name</label>
                    <input
                      className="form-input"
                      placeholder="Recipient name"
                      value={createForm.customer_name}
                      onChange={e => setCreateForm(p => ({ ...p, customer_name: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Customer Phone</label>
                    <input
                      className="form-input"
                      placeholder="919876543210"
                      value={createForm.customer_phone}
                      onChange={e => setCreateForm(p => ({ ...p, customer_phone: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Expiry Time Limit</label>
                  <select
                    className="form-select"
                    value={createForm.expires_in_days}
                    onChange={e => setCreateForm(p => ({ ...p, expires_in_days: e.target.value }))}
                  >
                    <option value="0">Never expires</option>
                    <option value="1">1 Day</option>
                    <option value="3">3 Days</option>
                    <option value="5">5 Days</option>
                    <option value="7">1 Week</option>
                    <option value="15">15 Days</option>
                    <option value="30">30 Days</option>
                    <option value="60">60 Days</option>
                    <option value="90">90 Days</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">🎫 Create Coupon</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === SHARE MODAL === */}
      {showShareModal && (
        <div className="modal-overlay" onClick={() => setShowShareModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📤 Share Coupon</h3>
              <button className="modal-close" onClick={() => setShowShareModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-display)', background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {formatCurrency(showShareModal.amount, showShareModal.currency)}
                </div>
                {showShareModal.description && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{showShareModal.description}</p>}
              </div>

              <div className="share-options">
                <div className="share-option whatsapp" onClick={() => shareWhatsApp(showShareModal)}>
                  <div className="share-icon">💬</div>
                  <div className="share-info">
                    <h4>WhatsApp</h4>
                    <p>Send via WhatsApp message</p>
                  </div>
                </div>
                <div className="share-option sms" onClick={() => shareSMS(showShareModal)}>
                  <div className="share-icon">📱</div>
                  <div className="share-info">
                    <h4>SMS</h4>
                    <p>Send via text message</p>
                  </div>
                </div>
                <div className="share-option copy" onClick={() => { copyLink(showShareModal.uuid); setShowShareModal(null); }}>
                  <div className="share-icon">🔗</div>
                  <div className="share-info">
                    <h4>Copy Link</h4>
                    <p>Copy coupon link to clipboard</p>
                  </div>
                </div>
              </div>

              <div className="share-link-box">
                <input readOnly value={getCouponLink(showShareModal.uuid)} />
                <button className="btn btn-sm btn-ghost" onClick={() => copyLink(showShareModal.uuid)}>📋</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
