import { Navigate, useSearchParams } from 'react-router-dom';

/** Old combined page: keep every existing link working. */
export default function BonusEarningsRedirect() {
  const [params] = useSearchParams();
  const to = params.get('tab') === 'content' ? '/content-rewards' : '/affiliates';
  return <Navigate to={to} replace />;
}
