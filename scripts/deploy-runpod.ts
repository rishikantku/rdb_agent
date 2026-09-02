// ============================================================================
// RunPod GPU Pod Deployment — Qwen3-Coder-Next via vLLM
// ============================================================================
// Deploys a GPU pod on RunPod running vLLM with Qwen3-Coder-Next.
// Uses the RunPod REST API to create and manage the pod.
//
// Usage:
//   npx tsx scripts/deploy-runpod.ts
//
// Prerequisites:
//   - RUNPOD_API_KEY in .env
//
// Architecture:
//   Mac → HTTPS → RunPod GPU Pod → vLLM → Qwen3-Coder-Next → SQL generation
// ============================================================================

import * as dotenv from 'dotenv';
dotenv.config();

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY!;
const RUNPOD_API_URL = 'https://api.runpod.io/graphql';

if (!RUNPOD_API_KEY) {
  console.error('❌ RUNPOD_API_KEY not found in .env');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const POD_CONFIG = {
  name: 'rdb-agent-qwen3-coder',
  // Qwen3-Coder-Next: 80B total params, ~3B active (MoE)
  // MoE loads ALL expert weights — needs ~160GB at FP16
  // With 8-bit quantization: ~80GB weights + KV cache = ~100GB
  // H200 NVL (143GB VRAM) gives comfortable headroom
  gpuTypeId: 'NVIDIA H200',                       // $3.59/hr, 141GB VRAM
  fallbackGpuTypeId: 'NVIDIA H100 NVL',            // $2.59/hr, 94GB VRAM — with FP8
  gpuCount: 1,
  volumeInGb: 200,                               // 80B model weights + HF cache + FP8 calibration
  containerDiskInGb: 60,                         // Container storage
  // vLLM Docker image with CUDA
  imageName: 'vllm/vllm-openai:latest',
  // vLLM startup command — quantized for H200
  dockerArgs: [
    '--model', 'Qwen/Qwen3-Coder-Next',
    '--served-model-name', 'Qwen/Qwen3-Coder-Next',
    '--host', '0.0.0.0',
    '--port', '8000',
    '--max-model-len', '32768',
    '--dtype', 'auto',
    '--quantization', 'fp8',           // FP8 quantization: ~80GB, near-FP16 quality
    '--trust-remote-code',
    '--enable-prefix-caching',
    '--max-num-seqs', '5',             // Conservative concurrency initially
    '--gpu-memory-utilization', '0.92',
  ].join(' '),
  // Expose port 8000 for the OpenAI-compatible API
  ports: '8000/http',
  // Volume mount path for HuggingFace cache
  volumeMountPath: '/root/.cache/huggingface',
};

// ---------------------------------------------------------------------------
// GraphQL queries
// ---------------------------------------------------------------------------

async function runpodQuery(query: string, variables: Record<string, any> = {}): Promise<any> {
  const url = `${RUNPOD_API_URL}?api_key=${RUNPOD_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`RunPod API error: ${res.status} ${res.statusText} ${body}`);
  }

  const data = await res.json();
  if (data.errors) {
    throw new Error(`RunPod GraphQL error: ${JSON.stringify(data.errors)}`);
  }

  return data.data;
}

// ---------------------------------------------------------------------------
// List available GPU types
// ---------------------------------------------------------------------------

async function listGpuTypes(): Promise<void> {
  console.log('\n📋 Available GPU Types (40GB+ VRAM):\n');

  const data = await runpodQuery(`
    query {
      gpuTypes {
        id
        displayName
        memoryInGb
        secureCloud
        communityCloud
        securePrice
        communityPrice
      }
    }
  `);

  const gpus = data.gpuTypes
    .filter((g: any) => g.memoryInGb >= 40)
    .sort((a: any, b: any) => (a.communityPrice || a.securePrice || 999) - (b.communityPrice || b.securePrice || 999));

  for (const gpu of gpus) {
    const price = gpu.communityPrice || gpu.securePrice;
    const cloud = gpu.secureCloud ? '☁️  Secure' : '';
    const community = gpu.communityCloud ? '🏘️  Community' : '';
    console.log(
      `  ${gpu.id.padEnd(25)} ${gpu.displayName.padEnd(30)} ${String(gpu.memoryInGb + 'GB').padStart(6)} ` +
      `  ${price ? '$' + price.toFixed(2) + '/hr' : 'N/A'}  ${cloud} ${community}`
    );
  }
}

// ---------------------------------------------------------------------------
// Create GPU Pod
// ---------------------------------------------------------------------------

async function createPod(): Promise<string> {
  console.log('\n🚀 Creating RunPod GPU pod...');
  console.log(`   Model: Qwen3-Coder-Next (80B MoE, ~3B active)`);
  console.log(`   GPU: ${POD_CONFIG.gpuTypeId}`);
  console.log(`   Server: vLLM (OpenAI-compatible)`);

  const data = await runpodQuery(`
    mutation CreatePod($input: PodFindAndDeployOnDemandInput!) {
      podFindAndDeployOnDemand(input: $input) {
        id
        name
        desiredStatus
        imageName
        machineId
        machine {
          gpuDisplayName
          podHostId
        }
      }
    }
  `, {
    input: {
      name: POD_CONFIG.name,
      imageName: POD_CONFIG.imageName,
      gpuTypeId: POD_CONFIG.gpuTypeId,
      gpuCount: POD_CONFIG.gpuCount,
      volumeInGb: POD_CONFIG.volumeInGb,
      containerDiskInGb: POD_CONFIG.containerDiskInGb,
      ports: POD_CONFIG.ports,
      volumeMountPath: POD_CONFIG.volumeMountPath,
      dockerArgs: POD_CONFIG.dockerArgs,
      startJupyter: false,
      startSsh: true,
      // Cloud type preference
      cloudType: 'ALL',
      // HuggingFace token for gated models (if needed)
      env: [
        { key: 'HUGGING_FACE_HUB_TOKEN', value: process.env.HF_TOKEN || '' },
      ],
    },
  });

  const pod = data.podFindAndDeployOnDemand;
  console.log(`\n✅ Pod created!`);
  console.log(`   Pod ID: ${pod.id}`);
  console.log(`   Name: ${pod.name}`);
  console.log(`   Status: ${pod.desiredStatus}`);
  console.log(`   GPU: ${pod.machine?.gpuDisplayName || 'allocating...'}`);

  return pod.id;
}

// ---------------------------------------------------------------------------
// Get pod status and endpoint URL
// ---------------------------------------------------------------------------

async function getPodStatus(podId: string): Promise<{ status: string; url?: string }> {
  const data = await runpodQuery(`
    query Pod($podId: String!) {
      pod(input: { podId: $podId }) {
        id
        name
        desiredStatus
        lastStatusChange
        imageName
        runtime {
          uptimeInSeconds
          ports {
            ip
            isIpPublic
            privatePort
            publicPort
            type
          }
          gpus {
            id
            gpuUtilPercent
            memoryUtilPercent
          }
        }
        machine {
          gpuDisplayName
        }
      }
    }
  `, { podId });

  const pod = data.pod;
  if (!pod) {
    return { status: 'NOT_FOUND' };
  }

  // RunPod proxy URL is always available for RUNNING pods
  const url = pod.desiredStatus === 'RUNNING'
    ? `https://${podId}-8000.proxy.runpod.net/v1`
    : undefined;

  return {
    status: pod.desiredStatus,
    url,
  };
}

// ---------------------------------------------------------------------------
// Wait for pod to be ready
// ---------------------------------------------------------------------------

async function waitForPod(podId: string, maxWaitMs = 600000): Promise<string> {
  console.log('\n⏳ Waiting for pod to start and model to load...');
  console.log('   (Qwen3-Coder-Next takes ~3-5 min to download + load)\n');

  const startTime = Date.now();
  let lastStatus = '';

  while (Date.now() - startTime < maxWaitMs) {
    const { status, url } = await getPodStatus(podId);

    if (status !== lastStatus) {
      console.log(`   Status: ${status} (${Math.round((Date.now() - startTime) / 1000)}s)`);
      lastStatus = status;
    }

    if (status === 'RUNNING' && url) {
      // Check if vLLM is actually ready (not just the pod)
      try {
        const healthRes = await fetch(`${url}/models`, {
          signal: AbortSignal.timeout(10000),
        });
        if (healthRes.ok) {
          const models = await healthRes.json();
          console.log(`\n✅ vLLM is ready!`);
          console.log(`   Endpoint: ${url}`);
          console.log(`   Models: ${JSON.stringify(models.data?.map((m: any) => m.id) || [])}`);
          return url;
        }
      } catch {
        // vLLM not ready yet, keep waiting
        process.stdout.write('.');
      }
    }

    await new Promise(r => setTimeout(r, 10000)); // Poll every 10s
  }

  throw new Error('Pod did not become ready within timeout');
}

// ---------------------------------------------------------------------------
// Update .env with the endpoint
// ---------------------------------------------------------------------------

function updateEnvFile(endpoint: string): void {
  const envPath = '.env';
  const fs = require('fs');
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

  // Add or update LLM_BASE_URL
  const llmVars: Record<string, string> = {
    'LLM_BASE_URL': endpoint,
    'LLM_MODEL': 'Qwen/Qwen3-Coder-Next',
    'LLM_API_KEY': RUNPOD_API_KEY,
    'LLM_TEMPERATURE': '0.05',
    'LLM_MAX_TOKENS': '4096',
    'LLM_TIMEOUT_MS': '120000',
  };

  for (const [key, value] of Object.entries(llmVars)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }

  fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf-8');
  console.log(`\n✅ .env updated with LLM configuration`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const command = process.argv[2] || 'deploy';

  switch (command) {
    case 'gpus':
      await listGpuTypes();
      break;

    case 'deploy': {
      const podId = await createPod();
      const endpoint = await waitForPod(podId);
      updateEnvFile(endpoint);

      console.log('\n' + '='.repeat(60));
      console.log('🎉 Deployment complete!');
      console.log('='.repeat(60));
      console.log(`\nYour vLLM endpoint: ${endpoint}`);
      console.log(`Pod ID: ${podId}`);
      console.log(`\nTest it:`);
      console.log(`  curl ${endpoint}/models -H "Authorization: Bearer $RUNPOD_API_KEY"`);
      console.log(`\nTo stop the pod:`);
      console.log(`  npx tsx scripts/deploy-runpod.ts stop ${podId}`);
      break;
    }

    case 'status': {
      const statusPodId = process.argv[3];
      if (!statusPodId) {
        console.error('Usage: npx tsx scripts/deploy-runpod.ts status <pod-id>');
        process.exit(1);
      }
      const { status, url } = await getPodStatus(statusPodId);
      console.log(`Pod ${statusPodId}: ${status}`);
      if (url) console.log(`Endpoint: ${url}`);
      break;
    }

    case 'stop': {
      const stopPodId = process.argv[3];
      if (!stopPodId) {
        console.error('Usage: npx tsx scripts/deploy-runpod.ts stop <pod-id>');
        process.exit(1);
      }
      await runpodQuery(`
        mutation StopPod($podId: String!) {
          podStop(input: { podId: $podId }) {
            id
            desiredStatus
          }
        }
      `, { podId: stopPodId });
      console.log(`✅ Pod ${stopPodId} stopped`);
      break;
    }

    case 'terminate': {
      const termPodId = process.argv[3];
      if (!termPodId) {
        console.error('Usage: npx tsx scripts/deploy-runpod.ts terminate <pod-id>');
        process.exit(1);
      }
      await runpodQuery(`
        mutation TerminatePod($podId: String!) {
          podTerminate(input: { podId: $podId })
        }
      `, { podId: termPodId });
      console.log(`✅ Pod ${termPodId} terminated`);
      break;
    }

    default:
      console.log('Usage: npx tsx scripts/deploy-runpod.ts [deploy|gpus|status|stop|terminate] [pod-id]');
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
