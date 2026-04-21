// ─── Register Page ───────────────────────────────────────────
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { UserPlus } from 'lucide-react';
import api from '../lib/api';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', universityId: '' });
  const [loading, setLoading] = useState(false);
  const [universities, setUniversities] = useState([]);
  const { register } = useAuth();
  const router = useRouter();

  useEffect(() => {
    api.get('/universities')
      .then(setUniversities)
      .catch(() => setUniversities([]));
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register({ ...form, universityId: parseInt(form.universityId) });
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
            <input name="name" value={form.name} onChange={handleChange} className="input" placeholder="John Doe" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} className="input" placeholder="you@university.edu" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input name="password" type="password" value={form.password} onChange={handleChange} className="input" placeholder="Min 6 characters" required minLength={6} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">University</label>
            <select name="universityId" value={form.universityId} onChange={handleChange} className="input" required>
              <option value="">Select university...</option>
              {universities.map((u) => (
                <option key={u.id} value={u.id}>{u.name}{u.country ? `, ${u.country}` : ''}</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
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
