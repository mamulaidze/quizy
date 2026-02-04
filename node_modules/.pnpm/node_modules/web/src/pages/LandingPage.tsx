import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function LandingPage() {
  return (
    <div className="hero-gradient rounded-3xl border p-6 md:p-12">
      <div className="grid gap-8 md:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-6">
          <Badge>Live Quiz Platform</Badge>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
            Host real-time quiz battles with live leaderboards and lightning-fast play.
          </h1>
          <p className="text-muted-foreground">
            QuizLive lets creators craft quizzes, launch live sessions, and let anyone join instantly on their phone.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/join">Join a Game</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/dashboard">Create a Quiz</Link>
            </Button>
          </div>
        </div>
        <Card className="glass">
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">How it works</p>
              <h2 className="text-2xl font-semibold">Spin up a session in seconds</h2>
            </div>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>1. Create a quiz with time-based questions.</li>
              <li>2. Start a live session and share the join code.</li>
              <li>3. Players answer on their phones and watch the leaderboard climb.</li>
            </ul>
            <Button asChild variant="secondary" className="w-full">
              <Link to="/auth/register">Get Started</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
