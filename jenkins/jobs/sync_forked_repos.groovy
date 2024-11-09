pipelineJob('sync-forked-repos') {
  definition {
    cpsScm {
      scm {
        git {
          remote {
            url('https://github.com/hainenber/automated-infrastructures.git')
          }
          branch('*/main')
        }
      }
      scriptPath('jenkins/pipelines/sync_forked_repos.Jenkinsfile')
      lightweight()
    }
  }
}