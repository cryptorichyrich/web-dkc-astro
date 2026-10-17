import subprocess, os

token = ''
with open(r'C:\Users\fxwis\AppData\Local\hermes\.env') as f:
    for line in f:
        if 'CLOUDFLARE_API_TOKEN' in line:
            token = line.strip().split('=', 1)[1]
            break

os.chdir(r'C:\Users\fxwis\web-dkc-astro')
env = os.environ.copy()
env['CLOUDFLARE_API_TOKEN'] = token
r = subprocess.run(
    'npx wrangler pages deploy dist/ --project-name=web-dkc-astro --commit-dirty=true',
    env=env, capture_output=True, text=True, shell=True
)
print(r.stdout)
if r.stderr:
    print(r.stderr)
