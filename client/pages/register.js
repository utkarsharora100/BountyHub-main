import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { UserPlus } from 'lucide-react';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'STUDENT' });
  const [loading, setLoading] = useState(false);

  // University Autocomplete State
  const [uniQuery, setUniQuery] = useState('');
  const [selectedUni, setSelectedUni] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef();

  const { register } = useAuth();
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    if (uniQuery.length < 3 || selectedUni?.name === uniQuery) {
      setSuggestions([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`http://universities.hipolabs.com/search?name=${encodeURIComponent(uniQuery)}`);
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        if (!isMounted) return;
        if (!Array.isArray(data)) throw new Error('Invalid format');
        // Deduplicate identical names from the API and limit to 20
        const uniqueData = Array.from(new Map(data.map(item => [item.name, item])).values()).slice(0, 20);
        setSuggestions(uniqueData);
        setShowSuggestions(true);
      } catch (err) {
        if (isMounted) setSuggestions([]);
      }
    }, 400);
    return () => {
      isMounted = false;
      clearTimeout(debounceRef.current);
    };
  }, [uniQuery, selectedUni]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUni) {
      return toast.error('Please select a university from the suggestions dropdown.');
    }
    if (selectedUni.name === 'Other (Not Listed)' && !selectedUni.customName) {
      return toast.error('Please enter your university name.');
    }
    setLoading(true);
    try {
      await register({
        ...form,
        universityName: selectedUni.name === 'Other (Not Listed)' ? selectedUni.customName : selectedUni.name,
        universityCountry: selectedUni.country || 'Unknown'
      });
      toast.success('Account created!');
      router.push('/');
    } catch (err) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 animate-fade-in">
      <div className="card p-8">
        <div className="text-center mb-6">
          <UserPlus className="w-10 h-10 mx-auto text-primary-600 mb-2" />
          <h1 className="text-2xl font-bold">Create Account</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Join the bounty community</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Full Name</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className="input"
              placeholder="Your name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="input"
              placeholder="you@university.edu"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              className="input"
              placeholder="Min 6 characters"
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">University</label>
            <div className="relative">
              <input
                type="text"
                value={uniQuery}
                onChange={(e) => {
                  setUniQuery(e.target.value);
                  setSelectedUni(null);
                }}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setShowSuggestions(false)}
                className="input w-full"
                placeholder="Search your university..."
                required
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
                  {suggestions.map((u, i) => (
                    <div
                      key={i}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevents the input's onBlur from hiding this before the click registers
                        setSelectedUni(u);
                        setUniQuery(u.name);
                        setShowSuggestions(false);
                      }}
                      className="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <div className="font-medium text-gray-900 dark:text-gray-100">{u.name}</div>
                      <div className="text-xs text-gray-500">{u.country}</div>
                    </div>
                  ))}
                <div
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setSelectedUni({ name: 'Other (Not Listed)', country: 'Other' });
                    setUniQuery('Other (Not Listed)');
                    setShowSuggestions(false);
                  }}
                  className="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-t border-gray-200 dark:border-gray-700"
                >
                  <div className="font-medium text-gray-900 dark:text-gray-100">Other (Not Listed)</div>
                  <div className="text-xs text-gray-500">Type your university name manually</div>
                </div>
                </div>
              )}
            </div>
          {selectedUni?.name === 'Other (Not Listed)' && (
            <div className="mt-3 animate-fade-in">
              <input
                type="text"
                className="input w-full border-primary-500 ring-1 ring-primary-500"
                placeholder="Enter your university name..."
                onChange={(e) => setSelectedUni({ ...selectedUni, customName: e.target.value })}
                required
              />
            </div>
          )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">I am a</label>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="input"
              required
            >
              <option value="STUDENT">Student</option>
              <option value="STAFF">University Staff</option>
            </select>
          </div>

          <button type="submit" disabled={loading || !selectedUni} className="btn-primary w-full py-2.5">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-sm text-center text-gray-500 mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-primary-600 dark:text-primary-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
