import React, { useState, useEffect } from 'react'
import BallScene from './BallScene'
import './BallScenePage.css'

function BallScenePage() {
  const [leftArmRaised, setLeftArmRaised] = useState(false)
  const [rightArmRaised, setRightArmRaised] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)

  // Get camera angle from URL parameters
  const urlParams = new URLSearchParams(window.location.search)
  const cameraAngle = urlParams.get('angle') || 'default'

  // Get display name for the camera angle
  const getViewName = (angle) => {
    switch (angle) {
      case 'front': return 'Front View'
      case 'back': return 'Back View'
      case 'left': return 'Left View'
      case 'right': return 'Right View'
      case 'top': return 'Top View'
      default: return 'Default View'
    }
  }

  useEffect(() => {
    const checkPoseData = () => {
      try {
        const poseData = localStorage.getItem('poseData')
        if (poseData) {
          const data = JSON.parse(poseData)
          const timestamp = data.timestamp

          // Check if data is recent (within last 2 seconds)
          const isRecent = timestamp && (Date.now() - timestamp) < 2000

          if (isRecent) {
            setLeftArmRaised(data.leftArmRaised || false)
            setRightArmRaised(data.rightArmRaised || false)
            setIsConnected(true)
            setLastUpdate(new Date(timestamp).toLocaleTimeString())
          } else {
            setIsConnected(false)
          }
        } else {
          setIsConnected(false)
        }
      } catch (error) {
        console.error('Error reading pose data:', error)
        setIsConnected(false)
      }
    }

    // Check immediately and then every 100ms
    checkPoseData()
    const interval = setInterval(checkPoseData, 100)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="ball-scene-page">
      <div className="header">
        <h1>🎾 Pose-Controlled Ball Scene - {getViewName(cameraAngle)}</h1>
        <div className="connection-status">
          <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
          {lastUpdate && (
            <div className="last-update">Last update: {lastUpdate}</div>
          )}
        </div>
      </div>

      <div className="instructions">
        <p>Raise your left or right arm in the camera tab to control the balls!</p>
        {!isConnected && (
          <p className="warning">⚠️ No pose data detected. Make sure pose detection is running in the main tab.</p>
        )}
      </div>

      <div className="pose-status">
        <div className={`arm-status left ${leftArmRaised ? 'raised' : ''}`}>
          Left Arm: {leftArmRaised ? 'Raised' : 'Down'}
        </div>
        <div className={`arm-status right ${rightArmRaised ? 'raised' : ''}`}>
          Right Arm: {rightArmRaised ? 'Raised' : 'Down'}
        </div>
      </div>

      <div className="scene-container">
        <BallScene leftArmRaised={leftArmRaised} rightArmRaised={rightArmRaised} cameraAngle={cameraAngle} />
      </div>
    </div>
  )
}

export default BallScenePage