import jenkins.model.Jenkins
import hudson.model.Cause
import hudson.model.Result

// Trigger seed job
def jenkins = Jenkins.get()
def job = jenkins.getItemByFullName('seed')

if (job == null) {
    println("[INIT] Seed job not found. Exiting script")
    return
}

def cause = new Cause.RemoteCause("script", "Triggered by 00-trigger-seed-job.groovy")
def future = job.scheduleBuild2(0, cause)

if (future != null) {
    println("[INIT] Seed job triggered successfully. Waiting for the job to finish...")

    // Wait until the build is complete
    // Blocks the script until the build is finished 
    def build = future.get() 

    // Check the result of the build
    def result = build.getResult()

    if (result == Result.SUCCESS) {
        println("[INIT] Seed job completed successfully.")
    } else {
        println("[INIT] Seed job did not complete successfully. Status: ${result.toString()}")
    }
} else {
    println("[INIT] Failed to trigger seed job.")
}
