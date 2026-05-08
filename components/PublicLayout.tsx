import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="border-b border-gray-100 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <img src="/tourflow-logo.png" alt="TourFlow" className="h-10 w-auto object-contain" />
              </Link>
            </div>
            <nav className="hidden md:flex space-x-8">
              <Link to="/how-it-works" className="text-gray-600 hover:text-brand-teal transition-colors font-medium">How it Works</Link>
              <Link to="/for-operators" className="text-gray-600 hover:text-brand-teal transition-colors font-medium">For Operators</Link>
              <Link to="/for-providers" className="text-gray-600 hover:text-brand-teal transition-colors font-medium">For Providers</Link>
              <Link to="/pricing" className="text-gray-600 hover:text-brand-teal transition-colors font-medium">Pricing</Link>
              <Link to="/about" className="text-gray-600 hover:text-brand-teal transition-colors font-medium">About</Link>
              <Link to="/contact" className="text-gray-600 hover:text-brand-teal transition-colors font-medium">Contact</Link>
            </nav>
            <div className="flex items-center space-x-4">
              <Link to="/login" className="text-brand-charcoal font-bold hover:text-brand-teal transition-colors">
                Login
              </Link>
              <Link to="/signup" className="bg-[#ff7055] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#ff7055]/90 transition-colors">
                Get Started for Free
              </Link>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-grow">
        {children}
      </main>
      <footer className="bg-brand-charcoal text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center mb-4">
              <img src="/tourflow-logo-reversed.png" alt="TourFlow" className="h-10 w-auto object-contain" />
            </div>
            <p className="text-gray-400 text-sm">
              The B2B operational platform connecting tour operators, guides, drivers, and vehicle owners.
            </p>
          </div>
          <div>
            <h3 className="font-bold mb-4">Platform</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link to="/how-it-works" className="hover:text-white transition-colors">How it Works</Link></li>
              <li><Link to="/for-operators" className="hover:text-white transition-colors">For Operators</Link></li>
              <li><Link to="/for-providers" className="hover:text-white transition-colors">For Providers</Link></li>
              <li><Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
              <li><Link to="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold mb-4">Company</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link to="/about" className="hover:text-white transition-colors">About</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              <li><Link to="/conflict-resolution" className="hover:text-white transition-colors">Conflict Resolution</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms-of-service" className="hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-gray-800 text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} TourFlow. All rights reserved.
        </div>
      </footer>
    </div>
  );
};
