const LABELS = {
  pending: 'Pending approval', open: 'Bidding open', ended: 'Awaiting decision', sold: 'Sold', cancelled: 'Withdrawn',
  leading: 'You are leading', outbid: 'Outbid', won: 'Won', lost: 'Lost',
};

export default function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{LABELS[status] || status}</span>;
}
