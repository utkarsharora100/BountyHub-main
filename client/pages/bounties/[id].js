import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import Modal from '../../components/Modal';
import toast from 'react-hot-toast';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Award, Calendar, Clock, Users, MessageSquare, Send,
  CheckCircle, XCircle, ExternalLink, ArrowLeft, ChevronRight
} from 'lucide-react';
import Link from 'next/link';

const statusColors = {
  OPEN: 'badge-open',
  IN_PROGRESS: 'badge-in-progress',
  COMPLETED: 'badge-completed',
  CANCELLED: 'badge-cancelled',
};

// Avatar initial circle — used in several places, extracted to keep JSX cleaner.
function Avatar({ name, size = 'sm', color = 'primary' }) {
  const sizeClass = size === 'lg' ? 'w-10 h-10 text-sm' : 'w-7 h-7 text-xs';
  return (
    <div className={`${sizeClass} rounded-full bg-${color}-100 dark:bg-${color}-900 flex items-center justify-center font-bold text-${color}-700 dark:text-${color}-300 shrink-0`}>
      {name[0]}
    </div>
  );
}

export default function BountyDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();

  const [bounty, setBounty] = useState(null);
  const [bids, setBids] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [bidModal, setBidModal] = useState(false);
  const [submitModal, setSubmitModal] = useState(false);
  const [bidMessage, setBidMessage] = useState('');
  const [bidAmount, setBidAmount] = useState('');
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
      await api.post(`/bounties/${id}/bids`, { message: bidMessage, amount: bidAmount || undefined });
      toast.success('Bid placed!');
      setBidModal(false);
      setBidMessage('');
      setBidAmount('');
      loadAll();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleSubmitWork(e) {
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
      toast.success('Bid accepted — bounty is now in progress');
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
      toast.success(
        status === 'ACCEPTED'
          ? 'Accepted! Reputation points awarded.'
          : `Submission marked as ${status.toLowerCase()}`
      );
      loadAll();
    } catch (err) { toast.error(err.message); }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 animate-pulse">
        <div className="skeleton h-6 w-40" />
        <div className="skeleton h-10 w-2/3" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-4/5" />
        <div className="skeleton h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!bounty) {
    return <div className="text-center py-20 text-gray-500">Bounty not found</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-0 animate-fade-in">

      {/* Breadcrumb — helps users orient themselves in the forum hierarchy */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 py-3 border-b border-gray-200 dark:border-gray-800">
        <Link href="/bounties" className="hover:text-primary-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Bounties
        </Link>
        <ChevronRight className="w-3.5 h-3.5 opacity-50" />
        <span className="text-gray-400 truncate max-w-xs">{bounty.title}</span>
      </nav>

      {/* ── Original Post ──────────────────────────────────── */}
      {/* This is the "question" in forum terms — the bounty itself */}
      <div className="py-6 border-b border-gray-200 dark:border-gray-800">

        {/* Title + badges */}
        <div className="flex flex-wrap items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white leading-tight">
              {bounty.title}
            </h1>
          </div>
          {/* Reward is the most important number on this page — make it obvious */}
          <div className="flex items-center gap-1.5 text-2xl font-bold text-amber-600 dark:text-amber-400 shrink-0">
            <Award className="w-7 h-7" />
            {bounty.rewardPoints} pts
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2 text-sm mb-5">
          <span className={statusColors[bounty.status]}>{bounty.status.replace('_', ' ')}</span>
          <span className="badge bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300">
            {bounty.category}
          </span>
          <span className="text-gray-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            asked {formatDistanceToNow(new Date(bounty.createdAt), { addSuffix: true })}
          </span>
          {bounty.deadline && (
            <span className="text-gray-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              due {format(new Date(bounty.deadline), 'MMM d, yyyy')}
            </span>
          )}
        </div>

        {/* Post body — the actual description */}
        <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap border-t border-gray-100 dark:border-gray-800 pt-4">
          {bounty.description}
        </div>

        {/* Posted by */}
        {bounty.creator && (
          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between flex-wrap gap-3">
            <Link href={`/profile/${bounty.creator.id}`} className="flex items-center gap-2 text-sm hover:text-primary-600 transition-colors">
              <Avatar name={bounty.creator.name} size="lg" />
              <div>
                <p className="font-semibold">{bounty.creator.name}</p>
                {bounty.creator.university && (
                  <p className="text-xs text-gray-400">{bounty.creator.university.name}</p>
                )}
              </div>
            </Link>

            {/* Action buttons — only shown to non-owners when bounty is active */}
            {user && !isOwner && (bounty.status === 'OPEN' || bounty.status === 'IN_PROGRESS') && (
              <div className="flex gap-2">
                {bounty.status === 'OPEN' && (
                  <button onClick={() => setBidModal(true)} className="btn-primary text-sm">
                    <Users className="w-4 h-4 mr-1.5" /> Bid on This
                  </button>
                )}
                <button onClick={() => setSubmitModal(true)} className="btn-secondary text-sm">
                  <Send className="w-4 h-4 mr-1.5" /> Submit Work
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bids (Answers) ────────────────────────────────── */}
      {/* Framed like "X answers" — the main call-to-action section */}
      <section className="pt-6 pb-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary-500" />
          {bids.length} {bids.length === 1 ? 'Bid' : 'Bids'}
        </h2>

        {bids.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No bids yet — be the first to apply.</p>
        ) : (
          <div className="space-y-0 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            {bids.map((bid, i) => (
              <div
                key={bid.id}
                className={`flex gap-3 p-4 ${i > 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''} ${
                  bid.status === 'ACCEPTED' ? 'bg-green-50/50 dark:bg-green-900/10' : ''
                }`}
              >
                <Avatar name={bid.bidder.name} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm mb-1.5">
                    <Link href={`/profile/${bid.bidder.id}`} className="font-semibold hover:text-primary-600">
                      {bid.bidder.name}
                    </Link>
                    {bid.bidder.university && (
                      <span className="text-xs text-gray-400">{bid.bidder.university.name}</span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">
                      {formatDistanceToNow(new Date(bid.createdAt), { addSuffix: true })}
                    </span>
                  </div>

                  <p className="text-sm text-gray-700 dark:text-gray-300">{bid.message}</p>

                  <div className="flex items-center gap-3 mt-2">
                    <span className={`badge text-xs ${
                      bid.status === 'ACCEPTED' ? 'badge-completed' :
                      bid.status === 'REJECTED' ? 'badge-cancelled' : 'badge-open'
                    }`}>
                      {bid.status}
                    </span>

                    {/* Accept/reject only visible to the bounty owner while bid is still pending */}
                    {isOwner && bid.status === 'PENDING' && (
                      <div className="flex gap-2 ml-1">
                        <button
                          onClick={() => handleAcceptBid(bid.id)}
                          className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-0.5"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Accept
                        </button>
                        <button
                          onClick={() => handleRejectBid(bid.id)}
                          className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-0.5"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Submissions ────────────────────────────────────── */}
      <section className="pt-6 pb-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Send className="w-5 h-5 text-primary-500" />
          {submissions.length} {submissions.length === 1 ? 'Submission' : 'Submissions'}
        </h2>

        {submissions.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No submissions yet.</p>
        ) : (
          <div className="space-y-0 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            {submissions.map((sub, i) => (
              <div
                key={sub.id}
                className={`flex gap-3 p-4 ${i > 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''} ${
                  sub.status === 'ACCEPTED' ? 'bg-green-50/50 dark:bg-green-900/10' : ''
                }`}
              >
                <Avatar name={sub.submitter.name} color="green" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm mb-1.5">
                    <Link href={`/profile/${sub.submitter.id}`} className="font-semibold hover:text-primary-600">
                      {sub.submitter.name}
                    </Link>
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(sub.createdAt), { addSuffix: true })}
                    </span>
                  </div>

                  {sub.description && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{sub.description}</p>
                  )}

                  <a
                    href={sub.submissionLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View Submission
                  </a>

                  <div className="flex items-center gap-3 mt-2">
                    <span className={`badge text-xs ${
                      sub.status === 'ACCEPTED' ? 'badge-completed' :
                      sub.status === 'REJECTED' ? 'badge-cancelled' : 'badge-in-progress'
                    }`}>
                      {sub.status.replace('_', ' ')}
                    </span>

                    {isOwner && sub.status !== 'ACCEPTED' && (
                      <div className="flex gap-2 ml-1">
                        <button
                          onClick={() => handleReviewSubmission(sub.id, 'ACCEPTED')}
                          className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-0.5"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Accept
                        </button>
                        <button
                          onClick={() => handleReviewSubmission(sub.id, 'REJECTED')}
                          className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-0.5"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Discussion / Comments ──────────────────────────── */}
      {/* Intentionally kept lighter than bids/submissions — this is just chat, not binding */}
      <section className="pt-6 pb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary-500" />
          {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
        </h2>

        {/* Comment input — shown at top so it's immediately visible */}
        {user ? (
          <form onSubmit={handleComment} className="flex gap-2 mb-5">
            <Avatar name={user.name || 'U'} />
            <div className="flex-1 flex gap-2">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="input flex-1"
                placeholder="Add a comment..."
              />
              <button type="submit" className="btn-primary px-3" aria-label="Post comment">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-gray-400 mb-4">
            <Link href="/login" className="text-primary-600 hover:underline">Log in</Link> to join the discussion.
          </p>
        )}

        <div className="space-y-4">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-3">
              <Avatar name={c.user.name} />
              <div>
                <div className="flex items-center gap-2 text-sm mb-0.5">
                  <Link href={`/profile/${c.user.id}`} className="font-semibold hover:text-primary-600">
                    {c.user.name}
                  </Link>
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Modals ────────────────────────────────────────── */}
      <Modal isOpen={bidModal} onClose={() => setBidModal(false)} title="Place a Bid">
        <form onSubmit={handlePlaceBid} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Your pitch</label>
            <textarea
              value={bidMessage}
              onChange={(e) => setBidMessage(e.target.value)}
              className="input min-h-[100px]"
              placeholder="Why are you a good fit? What's your approach?"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Proposed Points (optional)</label>
            <input type="number" min="1" max={bounty.rewardPoints} value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} className="input" placeholder={`${bounty.rewardPoints} max`} />
          </div>
          <button type="submit" className="btn-primary w-full">Submit Bid</button>
        </form>
      </Modal>

      <Modal isOpen={submitModal} onClose={() => setSubmitModal(false)} title="Submit Your Work">
        <form onSubmit={handleSubmitWork} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Submission Link</label>
            <input
              type="url"
              value={subLink}
              onChange={(e) => setSubLink(e.target.value)}
              className="input"
              placeholder="https://github.com/..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes (optional)</label>
            <textarea
              value={subDesc}
              onChange={(e) => setSubDesc(e.target.value)}
              className="input min-h-[80px]"
              placeholder="Any notes for the reviewer..."
            />
          </div>
          <button type="submit" className="btn-primary w-full">Submit</button>
        </form>
      </Modal>

    </div>
  );
}
