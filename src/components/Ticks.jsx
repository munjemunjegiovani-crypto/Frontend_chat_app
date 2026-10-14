import { Icon } from './ui.jsx';

export default function Ticks({ status, onBubble = false, className = '' }) {
  if (status === 'pending') return <Icon name="schedule" size={14} className={`opacity-70 ${className}`} />;
  if (status === 'failed') return <Icon name="error" size={15} className={`text-danger ${className}`} />;
  if (status === 'sent') return <Icon name="check" size={15} className={`opacity-70 ${className}`} />;
  const readColor = onBubble ? 'text-[#E5C281] dark:text-[#14213D] !opacity-100' : 'text-gold';
  return <Icon name="done_all" size={15} className={`${status === 'read' ? readColor : 'opacity-70'} ${className}`} />;
}
