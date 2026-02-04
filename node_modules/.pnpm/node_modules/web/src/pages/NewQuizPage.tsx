import QuizEditor from '@/components/QuizEditor'

export default function NewQuizPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold">Create quiz</h1>
        <p className="text-muted-foreground">Build your question set.</p>
      </div>
      <QuizEditor />
    </div>
  )
}
