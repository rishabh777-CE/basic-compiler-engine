const express = require('express');
const bodyParser = require('body-parser');
const Docker = require('dockerode');
const tar = require('tar-fs');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(bodyParser.json());

// Docker setup


const docker = new Docker({socketPath: '/home/rishabh/.docker/desktop/docker.sock'});

// POST /compile endpoint
app.post('/compile', async (req, res) => {

  const { code, input, expected_output } = req.body;
  // Create a Docker container with gcc image

 
  
  const container = await docker.createContainer({
    Image: 'gcc',
    Cmd: ['/bin/bash', '-c', 'mkdir -p /app && /bin/bash'],
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
    OpenStdin: true,
    StdinOnce: false
  });

  await container.start();

  // change working directory to /app
  const containerId = container.id;
 
async function copyEntrypointToContainer(containerId) {
  const localEntrypointPath = './entrypoint.sh'; // Path to your local entrypoint.sh file
  const content = fs.readFileSync(localEntrypointPath);

  const container = docker.getContainer(containerId);

  // Create a tar stream containing the entrypoint.sh content
  const tarStream = require('tar-fs').pack(__dirname, {
    entries: ['entrypoint.sh'],
    map: function(header) {
      // Rename the file to /app/entrypoint.sh inside the container
      header.name = 'entrypoint.sh';
      return header;
    }
  });

  // Copy the tar stream to the container's /app directory
  await container.putArchive(tarStream, { path: '/app' });
  
  console.log('Entrypoint.sh copied to the container.');
}

await copyEntrypointToContainer(containerId);
// Usage: Provide your container ID as an argument when calling the function
// Example: copyEntrypointToContainer('your_container_id_here');

  // Write code, input, and expected_output to corresponding files in the container
  
//getting code input and expected output from the request body


async function writeFilesToContainer(containerId, code, input, output) {
  // Path to your local temporary files
  const tempDir = './';

  // Create temporary files for code, input, and output
  fs.writeFileSync(path.join(tempDir, 'main.cpp'), code);
  fs.writeFileSync(path.join(tempDir, 'input.txt'), input);
  fs.writeFileSync(path.join(tempDir, 'expected_output.txt'), output);

  const container = docker.getContainer(containerId);

  // Create a tar stream containing the files
  const tarStream = require('tar-fs').pack(tempDir, {
    entries: ['main.cpp', 'input.txt', 'expected_output.txt'],
    map: function(header) {
      // Rename files to /app directory inside the container
      header.name = path.basename(header.name);
      return header;
    }
  });

  // Copy the tar stream to the container's /app directory
  await container.putArchive(tarStream, { path: '/' });

  fs.unlinkSync(path.join(tempDir, 'main.cpp'));
  fs.unlinkSync(path.join(tempDir, 'input.txt'));
  fs.unlinkSync(path.join(tempDir, 'expected_output.txt'));
  console.log('Files copied to the container.');
}

  // Start the container
  // Start the container


// Wait for the container to start up
// await new Promise(resolve => setTimeout(resolve, 5000));

// Execute the entrypoint script in the container


// const tarStream = tar.pack('./', {
//   entries: ['entrypoint.sh'] // Only include the entrypoint.sh file in the tar archive
// });

// // Copy the tar archive into the container
// await new Promise((resolve, reject) => {
//   container.putArchive(tarStream, { path: '/app' }, (err) => {
//     if (err) {
//       reject(err);
//     } else {
//       resolve();
//     }
//   });
// });
writeFilesToContainer(containerId, code, input, expected_output);
const exec = await container.exec({
  Cmd: [
    '/bin/sh',
    '-c',
    'chmod +x /app/entrypoint.sh && /app/entrypoint.sh'
  ],
  AttachStdout: true,
  AttachStderr: true,
});
// Rest of your code...

  const stream = await exec.start();

  let result = '';
  stream.on('data', chunk => {
    result += chunk.toString('utf8');
  });

  stream.on('end', async () => {
    // Remove the container
  
    // cant remove a running container
    // await container.remove();

    // Send the verdict as the response
    res.json({ verdict: result.trim() });
  });
});

// Start the Express server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
