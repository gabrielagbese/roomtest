// Pose landmark indices for MediaPipe Pose
const POSE_LANDMARKS = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24
}

/**
 * Analyzes pose landmarks to determine if arms are raised
 * @param {Array} landmarks - Array of pose landmarks from MediaPipe
 * @returns {Object} - { leftArmRaised: boolean, rightArmRaised: boolean }
 */
export function analyzePose(landmarks) {
  if (!landmarks || landmarks.length === 0) {
    return { leftArmRaised: false, rightArmRaised: false }
  }

  const pose = landmarks[0] // Use first detected pose
  if (!pose || pose.length < 25) {
    return { leftArmRaised: false, rightArmRaised: false }
  }

  // Get key landmarks
  const leftShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER]
  const rightShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER]
  const leftElbow = pose[POSE_LANDMARKS.LEFT_ELBOW]
  const rightElbow = pose[POSE_LANDMARKS.RIGHT_ELBOW]
  const leftWrist = pose[POSE_LANDMARKS.LEFT_WRIST]
  const rightWrist = pose[POSE_LANDMARKS.RIGHT_WRIST]

  // Check if landmarks are visible (confidence > 0.5)
  const leftArmVisible = leftShoulder?.visibility > 0.5 &&
    leftElbow?.visibility > 0.5 &&
    leftWrist?.visibility > 0.5

  const rightArmVisible = rightShoulder?.visibility > 0.5 &&
    rightElbow?.visibility > 0.5 &&
    rightWrist?.visibility > 0.5

  let leftArmRaised = false
  let rightArmRaised = false

  // Analyze left arm
  if (leftArmVisible) {
    // Check if wrist is above shoulder (arm raised)
    const wristAboveShoulder = leftWrist.y < leftShoulder.y
    // Check if elbow is roughly at shoulder level or above
    const elbowRaised = leftElbow.y <= leftShoulder.y + 0.1

    leftArmRaised = wristAboveShoulder && elbowRaised
  }

  // Analyze right arm
  if (rightArmVisible) {
    // Check if wrist is above shoulder (arm raised)
    const wristAboveShoulder = rightWrist.y < rightShoulder.y
    // Check if elbow is roughly at shoulder level or above
    const elbowRaised = rightElbow.y <= rightShoulder.y + 0.1

    rightArmRaised = wristAboveShoulder && elbowRaised
  }

  return { leftArmRaised, rightArmRaised }
}

/**
 * Gets the shoulder width for normalization
 * @param {Array} landmarks - Array of pose landmarks
 * @returns {number} - Distance between shoulders
 */
export function getShoulderWidth(landmarks) {
  if (!landmarks || landmarks.length === 0) return 0

  const pose = landmarks[0]
  if (!pose || pose.length < 25) return 0

  const leftShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER]
  const rightShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER]

  if (!leftShoulder || !rightShoulder) return 0

  const dx = leftShoulder.x - rightShoulder.x
  const dy = leftShoulder.y - rightShoulder.y

  return Math.sqrt(dx * dx + dy * dy)
}