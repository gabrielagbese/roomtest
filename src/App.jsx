import { useState, useRef, useEffect } from 'react'
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision'
import '@tensorflow/tfjs-backend-webgl' // Still needed for TFJS runtime if not using WASM exclusively
import BallScene from './BallScene'
import { analyzePose } from './poseAnalysis'
import './App.css'

function App() {
  const [cameras, setCameras] = useState([])
  const [selectedCamera, setSelectedCamera] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState('')
  const [isPoseDetectionEnabled, setIsPoseDetectionEnabled] = useState(false)
  const [poses, setPoses] = useState([]) // Keep for storing results, though CodePen doesn't use state for this
  const [activeTab, setActiveTab] = useState('camera') // 'camera' or 'balls'
  const [leftArmRaised, setLeftArmRaised] = useState(false)
  const [rightArmRaised, setRightArmRaised] = useState(false)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const canvasRef = useRef(null)
  const poseLandmarkerRef = useRef(null) // Renamed from detectorRef
  const animationFrameIdRef = useRef(null) // Renamed from animationRef
  const drawingUtilsRef = useRef(null);

  // Get list of available cameras
  const getCameras = async () => {
    try {
      // Request permission first
      await navigator.mediaDevices.getUserMedia({ video: true })

      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(device => device.kind === 'videoinput')
      setCameras(videoDevices)

      if (videoDevices.length > 0 && !selectedCamera) {
        setSelectedCamera(videoDevices[0].deviceId)
      }
    } catch (err) {
      setError('Failed to access cameras: ' + err.message)
    }
  }

  // Start camera stream
  const startCamera = async (deviceId) => {
    try {
      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }

      const constraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setIsStreaming(true)
        setError('')
      }
    } catch (err) {
      setError('Failed to start camera: ' + err.message)
      setIsStreaming(false)
    }
  }

  // Stop camera stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setIsStreaming(false)
    setIsPoseDetectionEnabled(false)
  }

  // Handle camera selection change
  const handleCameraChange = (event) => {
    setSelectedCamera(event.target.value)
  }

  // Initialize pose detection (based on CodePen)
  const initializePoseLandmarker = async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );

      const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numPoses: 2
      });

      poseLandmarkerRef.current = poseLandmarker;

      // Initialize drawing utils
      if (canvasRef.current) {
        const canvasCtx = canvasRef.current.getContext("2d");
        drawingUtilsRef.current = new DrawingUtils(canvasCtx);
      }

      console.log('Pose landmarker initialized successfully');
    } catch (error) {
      console.error('Failed to initialize pose landmarker:', error);
      setError('Failed to initialize pose detection: ' + error.message);
    }
  };

  // Draw landmarks on canvas (based on CodePen)
  const drawLandmarks = (results) => {
    if (!canvasRef.current || !drawingUtilsRef.current) return;

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext("2d");

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    for (const landmarks of results.landmarks) {
      drawingUtilsRef.current.drawLandmarks(landmarks, {
        radius: (data) => DrawingUtils.lerp(data.from.z, -0.15, 0.1, 5, 1)
      });

      drawingUtilsRef.current.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS);
    }

    canvasCtx.restore();
  };

  // Pose detection loop (based on CodePen predictWebcam function)
  const predictWebcam = () => {
    if (!poseLandmarkerRef.current || !videoRef.current || !isPoseDetectionEnabled) {
      return;
    }

    const video = videoRef.current;

    if (video.readyState >= 2) { // HAVE_CURRENT_DATA
      let startTimeMs = performance.now();
      if (video.prevTime !== video.currentTime) {
        video.prevTime = video.currentTime;
        poseLandmarkerRef.current.detectForVideo(video, startTimeMs, (results) => {
          setPoses(results.landmarks); // Store landmarks if needed, or just draw
          drawLandmarks(results);

          // Analyze pose for arm positions
          const armAnalysis = analyzePose(results.landmarks);
          setLeftArmRaised(armAnalysis.leftArmRaised);
          setRightArmRaised(armAnalysis.rightArmRaised);

          // Store pose data in localStorage for ball scene communication
          localStorage.setItem('poseData', JSON.stringify({
            leftArmRaised: armAnalysis.leftArmRaised,
            rightArmRaised: armAnalysis.rightArmRaised,
            timestamp: Date.now()
          }));
        });
      }
    }

    if (isPoseDetectionEnabled) {
      animationFrameIdRef.current = requestAnimationFrame(predictWebcam);
    }
  };

  // Toggle pose detection
  const togglePoseDetection = async () => {
    if (!isPoseDetectionEnabled) {
      // Start pose detection
      if (!poseLandmarkerRef.current) {
        await initializePoseLandmarker();
      }

      if (poseLandmarkerRef.current) {
        setIsPoseDetectionEnabled(true);
        // predictWebcam will be called by useEffect
      }
    } else {
      // Stop pose detection
      setIsPoseDetectionEnabled(false);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }

      // Clear canvas
      if (canvasRef.current) {
        const canvasCtx = canvasRef.current.getContext("2d");
        canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  // Initialize cameras on component mount
  useEffect(() => {
    getCameras()

    // Cleanup on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current)
      }
    }
  }, [])

  // Start pose detection loop when enabled
  useEffect(() => {
    if (isPoseDetectionEnabled && isStreaming) {
      predictWebcam();
    } else if (!isPoseDetectionEnabled && animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [isPoseDetectionEnabled, isStreaming]);

  // Function to open ball scene in multiple tabs with different camera angles
  const openBallScene = () => {
    const cameraAngles = ['front', 'back', 'left', 'right', 'top'];

    cameraAngles.forEach((angle, index) => {
      const ballSceneUrl = `${window.location.origin}/ball-scene.html?angle=${angle}`;
      const windowName = `ballScene_${angle}`;
      const windowFeatures = `width=800,height=600,left=${100 + index * 200},top=${100 + index * 50}`;

      window.open(ballSceneUrl, windowName, windowFeatures);
    });
  };

  // Function to open a single camera view
  const openSingleView = (angle, viewName) => {
    const ballSceneUrl = `${window.location.origin}/ball-scene.html?angle=${angle}`;
    const windowName = `ballScene_${angle}`;
    const windowFeatures = 'width=800,height=600,left=200,top=100';
    
    window.open(ballSceneUrl, windowName, windowFeatures);
  };

  // Update canvas size when video loads or resizes, and when streaming starts
  useEffect(() => {
    const updateCanvasSize = () => {
      if (canvasRef.current && videoRef.current && isStreaming) {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        // Wait for video to have dimensions
        if (video.videoWidth && video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          // Update canvas style to match video display size
          const videoRect = video.getBoundingClientRect();
          canvas.style.width = videoRect.width + 'px';
          canvas.style.height = videoRect.height + 'px';
        }
      }
    };

    updateCanvasSize();

    // Also update on window resize
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [isStreaming]);

  return (
    <div className="app">
      <h1>Pose-Controlled Environment</h1>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'camera' ? 'active' : ''}`}
          onClick={() => setActiveTab('camera')}
        >
          Camera Tracking
        </button>
        <button
          className={`tab-button ${activeTab === 'balls' ? 'active' : ''}`}
          onClick={() => setActiveTab('balls')}
        >
          Ball Scene
        </button>
        <button
          className="launch-ball-scene"
          onClick={openBallScene}
        >
          🎾 Open All 5 Views
        </button>
      </div>

      {/* Individual Camera View Buttons */}
      <div className="individual-camera-buttons">
        <h3>Open Individual Camera Views:</h3>
        <div className="camera-button-grid">
          <button
            className="single-camera-button"
            onClick={() => openSingleView('front', 'Front View')}
          >
            📹 Front View
          </button>
          <button
            className="single-camera-button"
            onClick={() => openSingleView('back', 'Back View')}
          >
            📹 Back View
          </button>
          <button
            className="single-camera-button"
            onClick={() => openSingleView('left', 'Left View')}
          >
            📹 Left View
          </button>
          <button
            className="single-camera-button"
            onClick={() => openSingleView('right', 'Right View')}
          >
            📹 Right View
          </button>
          <button
            className="single-camera-button"
            onClick={() => openSingleView('top', 'Top View')}
          >
            📹 Top View
          </button>
        </div>
      </div>

      {/* Pose Status Indicator */}
      {isPoseDetectionEnabled && (
        <div className="pose-status">
          <div className={`arm-status left ${leftArmRaised ? 'raised' : ''}`}>
            Left Arm: {leftArmRaised ? 'Raised' : 'Down'}
          </div>
          <div className={`arm-status right ${rightArmRaised ? 'raised' : ''}`}>
            Right Arm: {rightArmRaised ? 'Raised' : 'Down'}
          </div>
        </div>
      )}

      {/* Camera Tab */}
      {activeTab === 'camera' && (
        <>
          <div className="controls">
            <div className="camera-selector">
              <label htmlFor="camera-select">Select Camera:</label>
              <select
                id="camera-select"
                value={selectedCamera}
                onChange={handleCameraChange}
                disabled={cameras.length === 0}
              >
                {cameras.length === 0 ? (
                  <option>No cameras found</option>
                ) : (
                  cameras.map((camera) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label || `Camera ${cameras.indexOf(camera) + 1}`}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="stream-controls">
              <button
                onClick={() => startCamera(selectedCamera)}
                disabled={!selectedCamera || isStreaming}
              >
                Start Camera
              </button>
              <button
                onClick={stopCamera}
                disabled={!isStreaming}
              >
                Stop Camera
              </button>
              <button onClick={getCameras}>
                Refresh Cameras
              </button>
              <button
                onClick={togglePoseDetection}
                disabled={!isStreaming} // Enable button only when streaming
                className={isPoseDetectionEnabled ? 'pose-active' : ''}
              >
                {isPoseDetectionEnabled ? 'Stop Pose Detection' : 'Start Pose Detection'}
              </button>
            </div>
          </div>

          {error && (
            <div className="error">
              {error}
            </div>
          )}

          <div className="video-container">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="video-stream"
              onLoadedData={() => {
                // This can be a good place to initially call predictWebcam if conditions are met
                // or ensure canvas is sized correctly.
                if (isPoseDetectionEnabled && isStreaming && poseLandmarkerRef.current) {
                  // predictWebcam(); // predictWebcam is now managed by useEffect
                }
              }}
            />
            <canvas
              ref={canvasRef}
              className="pose-overlay"
            />
            {!isStreaming && (
              <div className="video-placeholder">
                <p>Camera not active</p>
                <p>Select a camera and click "Start Camera" to begin</p>
              </div>
            )}
            {isPoseDetectionEnabled && poses && poses.length > 0 && (
              <div className="pose-info">
                <p>Pose Detection Active</p>
                {/* The CodePen example doesn't explicitly show number of poses, 
                    but focuses on drawing. We can keep this or remove it. 
                    For now, let's comment out the direct pose count from state 
                    as the drawing itself is the primary feedback. */}
                {/* <p>Detected Poses: {poses.length}</p> */}
              </div>
            )}
          </div>
        </>
      )}

      {/* Ball Scene Tab */}
      {activeTab === 'balls' && (
        <div className="ball-scene-container">
          <div className="scene-instructions">
            <p>Raise your left or right arm to lift the balls on that side of the room!</p>
            <p>Click "Open 5 Camera Views" to see the scene from 5 different angles in separate tabs.</p>
            <p>Note: Balls now start stationary and only move when arms are detected as raised.</p>
          </div>
          <BallScene leftArmRaised={leftArmRaised} rightArmRaised={rightArmRaised} cameraAngle="default" />
        </div>
      )}
    </div>
  )
}

export default App
