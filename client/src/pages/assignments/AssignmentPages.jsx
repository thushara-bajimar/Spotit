import { AssignmentDetail } from '../../components/assignments/AssignmentDetail.jsx';

/** /worker/assignments/:assignmentId */
export function WorkerAssignmentPage() {
  return <AssignmentDetail role="worker" />;
}

/** /employer/assignments/:assignmentId */
export function EmployerAssignmentPage() {
  return <AssignmentDetail role="employer" />;
}
