const fs = require('fs');
const path = require('path');

const filesToEditBrandLogo = [
  'components/DashboardLayout.tsx',
  'components/PublicLayout.tsx',
  'pages/Login.tsx',
  'pages/Signup.tsx',
  'pages/ForgotPassword.tsx',
  'pages/ResetPassword.tsx'
];

filesToEditBrandLogo.forEach(file => {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) return;
  let content = fs.readFileSync(p, 'utf8');
  content = content.replace(/import \{ BrandLogo \} from '[^']+';\n?/g, '');
  
  // Replace <BrandLogo className="foo" isReversed /> with <img src="/tourflow-logo-reversed.png" alt="TourFlow" className="foo object-contain" />
  content = content.replace(/<BrandLogo\s+className="([^"]+)"\s+isReversed\s*\/?\s*>/g, '<img src="/tourflow-logo-reversed.png" alt="TourFlow" className="$1 object-contain" />');
  
  // Replace <BrandLogo className="foo" /> with <img src="/tourflow-logo.png" alt="TourFlow" className="foo object-contain" />
  content = content.replace(/<BrandLogo\s+className="([^"]+)"\s*\/?\s*>/g, '<img src="/tourflow-logo.png" alt="TourFlow" className="$1 object-contain" />');
  
  // Replace <BrandLogo className="foo" isReversed={true} /> just in case
  content = content.replace(/<BrandLogo\s+className="([^"]+)"\s+isReversed=\{true\}\s*\/?\s*>/g, '<img src="/tourflow-logo-reversed.png" alt="TourFlow" className="$1 object-contain" />');

  // Replace <BrandLogo /> with <img src="/tourflow-logo.png" alt="TourFlow" className="object-contain" />
  content = content.replace(/<BrandLogo\s*\/?\s*>/g, '<img src="/tourflow-logo.png" alt="TourFlow" className="object-contain" />');
  
  fs.writeFileSync(p, content);
});

const pagesPublicDir = path.join(process.cwd(), 'pages/public');
if (fs.existsSync(pagesPublicDir)) {
  fs.readdirSync(pagesPublicDir).filter(f => f.endsWith('.tsx')).forEach(file => {
    const p = path.join(pagesPublicDir, file);
    let content = fs.readFileSync(p, 'utf8');
    content = content.replace(/import \{ SafeImage \} from '[^']+';\n?/g, '');
    
    // Replace <SafeImage src="..." ... /> with <img src="..." ... />
    content = content.replace(/<SafeImage([^>]*)>/g, '<img$1>');
    content = content.replace(/<\/SafeImage>/g, ''); 
    
    fs.writeFileSync(p, content);
  });
}
