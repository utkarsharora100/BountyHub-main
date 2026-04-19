// ─── Post New Bounty Page ────────────────────────────────────
import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../hooks/useAuth';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';

const CATEGORIES = ['CODING', 'RESEARCH', 'DESIGN', 'DEBUGGING', 'DOCUMENTATION', 'OTHER'];

export default function NewBounty() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    rewardPoints: '',
    category: 'CODING',
    deadline: '',
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please login first');
      return router.push('/login');
    }
    setLoading(true);
    try {
      const bounty = await api.post('/bounties', form);
      toast.success('Bounty posted!');
      router.push(`/bounties/${bounty.id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">Please log in to post a bounty</p>
        <Link href="/login" className="btn-primary">Log In</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="card p-8">
        <div className="flex items-center gap-2 mb-6">
          <PlusCircle className="w-6 h-6 text-primary-600" />
          <h1 className="text-2xl font-bold">Post a Bounty</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input name="title" value={form.title} onChange={handleChange} className="input" placeholder="e.g., Build a REST API for user management" required maxLength={300} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} className="input min-h-[160px]" placeholder="Describe the task in detail. Include requirements, deliverables, and any relevant links..." required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Reward Points</label>
              <input name="rewardPoints" type="number" min="1" value={form.rewardPoints} onChange={handleChange} className="input" placeholder="e.g., 100" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select name="category" value={form.category} onChange={handleChange} className="input">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Deadline (optional)</label>
            <input name="deadline" type="date" value={form.deadline} onChange={handleChange} className="input" />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-base">
            {loading ? 'Posting...' : 'Post Bounty'}
          </button>
        </form>
      </div>
    </div>
  );
}
