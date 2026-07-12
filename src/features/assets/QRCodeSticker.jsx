import { useState, useEffect } from 'react'
import QRCode from 'qrcode'

// QR Code Sticker Renderer Component. Extracted verbatim from App.jsx; it is the only
// consumer of the `qrcode` library, so keeping it in its own module lets that lib load
// with the sticker rather than in the initial bundle.
const QRCodeSticker = ({ asset }) => {
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    if (asset) {
      QRCode.toDataURL(
        JSON.stringify({
          id: asset.id,
          name: asset.name,
          serial: asset.serialNumber,
          category: asset.category,
          company: "NPS Enterprise"
        }),
        { margin: 2, width: 120 }
      ).then(url => {
        setQrUrl(url);
      }).catch(err => {
        console.error("QR Generation failed", err);
      });
    }
  }, [asset]);

  return (
    <div className="qr-sticker-card">
      <div className="sticker-header">
        <span className="sticker-company">NPS ENTERPRISE</span>
        <span className="sticker-logo">SECURE TAG</span>
      </div>
      <div className="sticker-body">
        <div className="sticker-qr">
          {qrUrl ? <img src={qrUrl} alt="QR Code" /> : <div style={{ fontSize: '9px' }}>Generating...</div>}
        </div>
        <div className="sticker-details">
          <div className="sticker-detail-row">
            <span className="sticker-label">Asset Code</span>
            <span className="sticker-val code">{asset.id}</span>
          </div>
          <div className="sticker-detail-row">
            <span className="sticker-label">Asset Type</span>
            <span className="sticker-val">{asset.type}</span>
          </div>
          <div className="sticker-detail-row">
            <span className="sticker-label">Serial Number</span>
            <span className="sticker-val">{asset.serialNumber}</span>
          </div>
        </div>
      </div>
      <div className="sticker-footer">
        <div className="barcode-visual">
          <div className="barcode-bar thick"></div>
          <div className="barcode-bar spacer"></div>
          <div className="barcode-bar thin"></div>
          <div className="barcode-bar medium"></div>
          <div className="barcode-bar thick"></div>
          <div className="barcode-bar spacer"></div>
          <div className="barcode-bar thin"></div>
          <div className="barcode-bar medium"></div>
          <div className="barcode-bar thin"></div>
          <div className="barcode-bar spacer"></div>
          <div className="barcode-bar thick"></div>
          <div className="barcode-bar thin"></div>
        </div>
      </div>
    </div>
  );
};

export default QRCodeSticker;
