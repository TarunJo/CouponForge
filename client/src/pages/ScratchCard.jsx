import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE } from '../context/AuthContext';

export default function ScratchCard() {
  const { uuid } = useParams();
  const [coupon, setCoupon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isScratching, setIsScratching] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [scratchProgress, setScratchProgress] = useState(0);
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef(null);
  const scratchTriggered = useRef(false);

  useEffect(() => {
    fetchCoupon();
  }, [uuid]);

  const fetchCoupon = async () => {
    try {
      const res = await fetch(`${API_BASE}/coupon/${uuid}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Coupon not found');
        return;
      }
      setCoupon(data.coupon);
      if (data.coupon.is_scratched) {
        scratchTriggered.current = true;
        setIsRevealed(true);
      }
    } catch (err) {
      setError('Failed to load coupon');
    } finally {
      setLoading(false);
    }
  };

  const handleScratch = async () => {
    if (scratchTriggered.current) return;
    scratchTriggered.current = true;

    try {
      const res = await fetch(`${API_BASE}/coupon/${uuid}/scratch`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        // If it was already scratched, refresh coupon details rather than showing error
        if (data.error && data.error.toLowerCase().includes('already')) {
          fetchCoupon();
          return;
        }
        setError(data.error);
        return;
      }
      setCoupon(data.coupon);
      setIsRevealed(true);
    } catch (err) {
      setError('Failed to scratch coupon');
    }
  };

  // Setup scratch canvas
  useEffect(() => {
    if (!coupon || coupon.is_scratched || isRevealed) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Draw scratch overlay pattern
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#2a2a3e');
    gradient.addColorStop(0.5, '#1f1f35');
    gradient.addColorStop(1, '#2a2a3e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add pattern texture
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let i = 0; i < canvas.width; i += 20) {
      for (let j = 0; j < canvas.height; j += 20) {
        ctx.fillRect(i, j, 1, 1);
      }
    }

    // Draw text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = 'bold 18px Outfit, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✨ SCRATCH HERE ✨', canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillText('Swipe to reveal your reward', canvas.width / 2, canvas.height / 2 + 20);

    ctx.globalCompositeOperation = 'destination-out';
  }, [coupon, isRevealed]);

  const getPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const scratch = (point) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (lastPoint.current) {
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(point.x, point.y);
      ctx.lineWidth = 45;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(point.x, point.y, 22, 0, Math.PI * 2);
    ctx.fill();

    lastPoint.current = point;

    // Calculate scratch progress
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    let cleared = 0;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] === 0) cleared++;
    }
    const progress = (cleared / (pixels.length / 4)) * 100;
    setScratchProgress(progress);

    if (progress > 40 && !scratchTriggered.current && !isRevealed) {
      handleScratch();
    }
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    isDrawing.current = true;
    setIsScratching(true);
    const point = getPoint(e);
    lastPoint.current = point;
    scratch(point);
  };

  const handlePointerMove = (e) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    scratch(getPoint(e));
  };

  const handlePointerUp = () => {
    isDrawing.current = false;
    lastPoint.current = null;
  };

  const formatCurrency = (amount, currency = 'INR') => {
    const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
    return `${symbols[currency] || currency} ${Number(amount).toLocaleString('en-IN')}`;
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : null;

  const getTimeRemaining = (expiresAt) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return 'Expired';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="expired-page">
        <div className="expired-icon">
          {error.includes('expired') ? '⏰' : error.includes('redeemed') ? '✅' : '❌'}
        </div>
        <h2>{error.includes('expired') ? 'Coupon Expired' : error.includes('redeemed') ? 'Already Redeemed' : 'Coupon Not Found'}</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="scratch-page">
      <div className="scratch-card-container animate-in">
        {/* Header */}
        <div className="scratch-card-header">
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '0.5rem' }}>
            🏪 {coupon.org_name}
          </div>
          <h2>{isRevealed ? '🎉 Congratulations!' : '🎰 Scratch & Win!'}</h2>
          <p>{isRevealed ? 'Your coupon has been revealed' : 'Scratch the card below to reveal your reward'}</p>
        </div>

        {/* Scratch Card */}
        <div className="scratch-card" style={{ border: isRevealed ? '2px solid rgba(34, 197, 94, 0.4)' : undefined }}>
          {/* Reward Content (behind canvas) */}
          <div className="scratch-card-content">
            <div style={{ fontSize: '1rem', marginBottom: '0.5rem', opacity: 0.8 }}>You won</div>
            <div className="amount">
              {coupon.amount ? formatCurrency(coupon.amount, coupon.currency) : '???'}
            </div>
            <div className="label">{coupon.description || 'Scratch Coupon Reward'}</div>
          </div>

          {/* Scratch Canvas Overlay */}
          {!isRevealed && (
            <canvas
              ref={canvasRef}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                cursor: 'pointer',
                touchAction: 'none',
              }}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            />
          )}
        </div>

        {/* Coupon Details (shown after scratch) */}
        {isRevealed && coupon && (
          <div className="coupon-details">
            <div className="detail-row">
              <span className="detail-label">Amount</span>
              <span className="detail-value" style={{ fontSize: '1.2rem', fontWeight: 800, background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {formatCurrency(coupon.amount, coupon.currency)}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Merchant</span>
              <span className="detail-value">{coupon.merchant_name} ({coupon.org_name})</span>
            </div>
            {coupon.description && (
              <div className="detail-row">
                <span className="detail-label">Description</span>
                <span className="detail-value">{coupon.description}</span>
              </div>
            )}
            {coupon.customer_name && (
              <div className="detail-row">
                <span className="detail-label">For</span>
                <span className="detail-value">{coupon.customer_name}</span>
              </div>
            )}
            <div className="detail-row">
              <span className="detail-label">Validation Code</span>
              <span className="detail-value validation-code">{coupon.validation_code}</span>
            </div>
            {coupon.expires_at && (
              <div className="detail-row">
                <span className="detail-label">Expires</span>
                <span className="detail-value">
                  {formatDate(coupon.expires_at)}
                  {getTimeRemaining(coupon.expires_at) && (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--warning-400)' }}>
                      ({getTimeRemaining(coupon.expires_at)})
                    </span>
                  )}
                </span>
              </div>
            )}
            <div className="detail-row">
              <span className="detail-label">Issued</span>
              <span className="detail-value">{formatDate(coupon.created_at)}</span>
            </div>

            {/* Instructions */}
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              background: 'rgba(124, 58, 237, 0.08)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(124, 58, 237, 0.15)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                📋 Show the <strong style={{ color: 'var(--primary-300)' }}>Validation Code</strong> to the merchant to redeem
              </div>
              <div style={{ fontSize: '2rem', fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '0.2em', background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {coupon.validation_code}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Branding footer */}
      <div style={{
        marginTop: '2rem',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.8rem',
        position: 'relative',
        zIndex: 1
      }}>
        Powered by <strong style={{ color: 'var(--primary-300)' }}>CouponForge</strong>
      </div>
    </div>
  );
}
