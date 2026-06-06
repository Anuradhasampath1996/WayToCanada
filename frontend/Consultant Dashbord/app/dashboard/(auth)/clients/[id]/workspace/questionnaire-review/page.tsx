import { QuestionnaireReviewClient } from "./questionnaire-review-client";

export default function QuestionnaireReviewPage({ params }: { params: Promise<{ id: string }> }) {
  return <QuestionnaireReviewClient paramsPromise={params} />;
}
