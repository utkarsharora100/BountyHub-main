// ─── Bounty Detail Page ──────────────────────────────────────
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import Modal from '../../components/Modal';
import toast from 'react-hot-toast';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Award, Calendar, Clock, Users, MessageSquare, Send, CheckCircle, XCircle, ExternalLink, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

const statusColors = {
  OPEN: 'badge-open',
  IN_PROGRESS: 'badge-in-progress',
  COMPLETED: 'badge-completed',
  CANCELLED: 'badge-cancelled',
};

export default function BountyDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();

  const [bounty, setBounty] = useState(null);
  const [bids, setBids] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [bidModal, setBidModal] = useState(false);
  const [submitModal, setSubmitModal] = useState(false);
  const [bidMessage, setBidMessage] = useState('');
  const [subLink, setSubLink] = useState('');
  const [subDesc, setSubDesc] = useState('');
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    if (!id) return;
    loadAll();
  }, [id]);

  async function loadAll() {
    setLoading(true);
    try {
      const [b, bidsRes, subsRes, comRes] = await Promise.all([
        api.get(`/bounties/${id}`),
        api.get(`/bounties/${id}/bids?limit=20`),
        api.get(`/bounties/${id}/submissions?limit=20`),
        api.get(`/bounties/${id}/comments?limit=50`),
      ]);
      setBounty(b);
      setBids(bidsRes.data || []);
      setSubmissions(subsRes.data || []);
      setComments(comRes.data || []);
    } catch {
      toast.error('Failed to load bounty');
    } finally {
      setLoading(false);
    }
  }

  const isOwner = user && bounty && user.id === bounty.createdBy;

  async function handlePlaceBid(e) {
    e.preventDefault();
    try {
      await api.post(`/bounties/${id}/bids`, { message: bidMessage });
      toast.success('Bid placed!');
      setBidModal(false);
      setBidMessage('');
      loadAll();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await api.post(`/bounties/${id}/submissions`, { submissionLink: subLink, description: subDesc });
      toast.success('Work submitted!');
      setSubmitModal(false);
      setSubLink('');
      setSubDesc('');
      loadAll();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      await api.post(`/bounties/${id}/comments`, { content: commentText });
      setCommentText('');
      loadAll();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleAcceptBid(bidId) {
    try {
      await api.patch(`/bounties/bids/${bidId}/accept`);
      toast.success('Bid accepted');
      loadAll();
    } catch (err) { toast.error(err.message); }
  }

  async function handleRejectBid(bidId) {
    try {
      await api.patch(`/bounties/bids/${bidId}/reject`);
      toast.success('Bid rejected');
      loadAll();
    } catch (err) { toast.error(err.message); }
  }

  async function handleReviewSubmission(subId, status) {
    try {
      await api.patch(`/bounties/submissions/${subId}/review`, { status });
      toast.success(status === 'ACCEPTED' ? 'Submission accepted! Reputation awarded.' : `Submission ${status.toLowerCase()}`);
      loadAll();
    } catch (err) { toast.error(err.message); }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-48 w-full" />
      </div>
    );
  }

  if (!bounty) {
    return <div className="text-center py-20 text-gray-500">Bounty not found</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Back link */}
      <Link href="/bounties" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Bounties
      </Link>

      {/* ── Header ────────────────────────────────────────── */}
      <div className="card p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold">{bounty.title}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
              <span className={statusColors[bounty.status]}>{bounty.status.replace('_', ' ')}</span>
              <span className="badge bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300">{bounty.category}</span>
              {bounty.department && <span className="badge bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">{bounty.department}</span>}
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDistanceToNow(new Date(bounty.createdAt), { addSuffix: true })}</span>
              {bounty.deadline && (
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Due {format(new Date(bounty.deadline), 'MMM d, yyyy')}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            <Award className="w-7 h-7" />
            {bounty.rewardPoints} pts
          </div>
        </div>

        {/* Creator */}
        {bounty.creator && (
          <Link href={`/profile/${bounty.creator.id}`} className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 transition-colors">
            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center font-bold text-primary-700 dark:text-primary-300 text-xs">
              {bounty.creator.name[0]}
            </div>
            <div>
              <span className="font-medium">{bounty.creator.name}</span>
              {bounty.creator.university && <span className="text-gray-400 ml-1">• {bounty.creator.university.name}</span>}
            </div>
          </Link>
        )}

        {/* Description */}
        <div className="prose prose-sm dark:prose-invert max-w-none pt-4 border-t border-gray-100 dark:border-gray-800">
          <p className="whitespace-pre-wrap">{bounty.description}</p>
        </div>

        {bounty.skills?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {bounty.skills.map((skill) => (
              <span key={skill} className="badge bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{skill}</span>
            ))}
          </div>
        )}

        {/* Actions */}
        {user && !isOwner && bounty.status === 'OPEN' && (
          <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button onClick={() => setBidModal(true)} className="btn-primary">
              <Users className="w-4 h-4 mr-1" /> Place Bid
            </button>
            <button onClick={() => setSubmitModal(true)} className="btn-secondary">
              <Send className="w-4 h-4 mr-1" /> Submit Work
            </button>
          </div>
        )}
        {user && !isOwner && bounty.status === 'IN_PROGRESS' && (
          <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button onClick={() => setSubmitModal(true)} className="btn-secondary">
              <Send className="w-4 h-4 mr-1" /> Submit Work
            </button>
          </div>
        )}
      </div>

      {/* ── Bids Section ──────────────────────────────────── */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary-500" /> Bids ({bids.length})
        </h2>
        {bids.length === 0 ? (
          <p className="text-sm text-gray-500">No bids yet</p>
        ) : (
          <div className="space-y-3">
            {bids.map((bid) => (
              <div key={bid.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-xs font-bold text-primary-700 dark:text-primary-300 shrink-0">
                  {bid.bidder.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <Link href={`/profile/${bid.bidder.id}`} className="font-medium hover:text-primary-600">{bid.bidder.name}</Link>
                    {bid.bidder.university && <span className="text-gray-400 text-xs">• {bid.bidder.university.name}</span>}
                    <span className="text-xs text-gray-400 ml-auto">{formatDistanceToNow(new Date(bid.createdAt), { addSuffix: true })}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{bid.message}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`badge text-xs ${bid.status === 'ACCEPTED' ? 'badge-completed' : bid.status === 'REJECTED' ? 'badge-cancelled' : 'badge-open'}`}>
                      {bid.status}
                    </span>
                    {isOwner && bid.status === 'PENDING' && (
                      <>
                        <button onClick={() => handleAcceptBid(bid.id)} className="text-xs text-green-600 hover:underline flex items-center gap-0.5"><CheckCircle className="w-3 h-3" />Accept</button>
                        <button onClick={() => handleRejectBid(bid.id)} className="text-xs text-red-600 hover:underline flex items-center gap-0.5"><XCircle className="w-3 h-3" />Reject</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Submissions Section ───────────────────────────── */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Send className="w-5 h-5 text-primary-500" /> Submissions ({submissions.length})
        </h2>
        {submissions.length === 0 ? (
          <p className="text-sm text-gray-500">No submissions yet</p>
        ) : (
          <div className="space-y-3">
            {submissions.map((sub) => (
              <div key={sub.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-xs font-bold text-green-700 dark:text-green-300 shrink-0">
                  {sub.submitter.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <Link href={`/profile/${sub.submitter.id}`} className="font-medium hover:text-primary-600">{sub.submitter.name}</Link>
                    <span className="text-xs text-gray-400">{formatDistanceToNow(new Date(sub.createdAt), { addSuffix: true })}</span>
                  </div>
                  {sub.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{sub.description}</p>}
                  <a href={sub.submissionLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline mt-1">
                    <ExternalLink className="w-3 h-3" /> View Submission
                  </a>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`badge text-xs ${sub.status === 'ACCEPTED' ? 'badge-completed' : sub.status === 'REJECTED' ? 'badge-cancelled' : 'badge-in-progress'}`}>
                      {sub.status}
                    </span>
                    {isOwner && sub.status !== 'ACCEPTED' && (
                      <>
                        <button onClick={() => handleReviewSubmission(sub.id, 'ACCEPTED')} className="text-xs text-green-600 hover:underline flex items-center gap-0.5"><CheckCircle className="w-3 h-3" />Accept</button>
                        <button onClick={() => handleReviewSubmission(sub.id, 'REJECTED')} className="text-xs text-red-600 hover:underline flex items-center gap-0.5"><XCircle className="w-3 h-3" />Reject</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Comments Section ──────────────────────────────── */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary-500" /> Comments ({comments.length})
        </h2>

        {user && (
          <form onSubmit={handleComment} className="flex gap-2 mb-4">
            <input value={commentText} onChange={(e) => setCommentText(e.target.value)} className="input flex-1" placeholder="Add a comment..." />
            <button type="submit" className="btn-primary px-4"><Send className="w-4 h-4" /></button>
          </form>
        )}

        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-400 shrink-0">
                {c.user.name[0]}
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm">
                  <Link href={`/profile/${c.user.id}`} className="font-medium hover:text-primary-600">{c.user.name}</Link>
                  <span className="text-xs text-gray-400">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Modals ────────────────────────────────────────── */}
      <Modal isOpen={bidModal} onClose={() => setBidModal(false)} title="Place a Bid">
        <form onSubmit={handlePlaceBid} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Your Message</label>
            <textarea value={bidMessage} onChange={(e) => setBidMessage(e.target.value)} className="input min-h-[100px]" placeholder="Explain why you're a good fit..." required />
          </div>
          <button type="submit" className="btn-primary w-full">Submit Bid</button>
        </form>
      </Modal>

      <Modal isOpen={submitModal} onClose={() => setSubmitModal(false)} title="Submit Work">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Submission Link</label>
            <input type="url" value={subLink} onChange={(e) => setSubLink(e.target.value)} className="input" placeholder="https://github.com/..." required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description (optional)</label>
            <textarea value={subDesc} onChange={(e) => setSubDesc(e.target.value)} className="input min-h-[80px]" placeholder="Brief description of your work..." />
          </div>
          <button type="submit" className="btn-primary w-full">Submit</button>
        </form>
      </Modal>
    </div>
  );
}
