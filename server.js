const express = require('express');
const bodyParser = require('body-parser');
const Docker = require('dockerode');
const tar = require('tar-fs');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(bodyParser.json());

// Docker setup


const docker = new Docker({socketPath: '/home/sarvjot/.docker/desktop/docker.sock'});

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

	// Start the exec instance and get the output stream
	const stream = await exec.start({
		hijack: true,
		stdin: true,
	});

	let response = '';
	stream.on('data', (chunk) => {
		response += chunk.toString();
	});

	// Wait for the exec instance to finish
	stream.on('end', async () => {
		// Get the exit code
		const { ExitCode } = await exec.inspect();

		// Send the response
		res.json({ response, ExitCode });
	})
});

// Start the Express server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
