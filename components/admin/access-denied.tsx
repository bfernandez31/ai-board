import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export default function AccessDenied() {
  return (
    <Alert variant="destructive">
      <AlertTitle>Access Denied</AlertTitle>
      <AlertDescription>
        You do not have permission to access the admin section.
        Please contact an administrator if you believe this is an error.
      </AlertDescription>
      <div className="mt-4">
        <Button variant="outline" onClick={() => window.history.back()}>
          Go Back
        </Button>
      </div>
    </Alert>
  )
}
