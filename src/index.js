// Constant to identify a React Component. It's been extracted from ReactTypeOfWork
// (https://github.com/facebook/react/blob/master/src/shared/ReactTypeOfWork.js#L20)
const ReactClassComponent = 2

function traverseRenderedChildren(internalInstance, callback, argument) {
  callback(internalInstance, argument)

  if (internalInstance._renderedComponent) {
    traverseRenderedChildren(
      internalInstance._renderedComponent,
      callback,
      argument,
    )
  } else {
    for (const key in internalInstance._renderedChildren) {
      if (internalInstance._renderedChildren.hasOwnProperty(key)) {
        traverseRenderedChildren(
          internalInstance._renderedChildren[key],
          callback,
          argument,
        )
      }
    }
  }
}

function setPendingForceUpdate(internalInstance) {
  if (internalInstance._pendingForceUpdate === false) {
    internalInstance._pendingForceUpdate = true
  }
}

function forceUpdateIfPending(internalInstance) {
  if (internalInstance._pendingForceUpdate === true) {
    const publicInstance = internalInstance._instance
    const { updater } = publicInstance

    if (typeof publicInstance.forceUpdate === 'function') {
      publicInstance.forceUpdate()
    } else if (updater && typeof updater.enqueueForceUpdate === 'function') {
      updater.enqueueForceUpdate(publicInstance)
    }
  }
}

function deepForceUpdateStack(instance) {
  const internalInstance = instance._reactInternalInstance
  traverseRenderedChildren(internalInstance, setPendingForceUpdate)
  traverseRenderedChildren(internalInstance, forceUpdateIfPending)
}

function onEnterFiber(node, toUpdate, shouldUpdate) {
  if (!toUpdate) {
    return undefined
  }
  if (node.tag === ReactClassComponent) {
    toUpdate.push(shouldUpdate(
      node.tag,
      node.stateNode,
      node._debugSource && node._debugSource.fileName,
    ))
  } else if (!toUpdate[toUpdate.length - 1]) {
    toUpdate[toUpdate.length - 1] = shouldUpdate(
      node.tag,
      null, // publicInstance
      node._debugSource && node._debugSource.fileName,
    )
  }
  return undefined
}

function onLeaveFiber(node, toUpdate, onUpdate) {
  if (node.tag !== ReactClassComponent || (toUpdate && !toUpdate.pop())) {
    return undefined
  }
  const publicInstance = node.stateNode
  const { updater } = publicInstance
  if (typeof publicInstance.forceUpdate === 'function') {
    publicInstance.forceUpdate()
  } else if (
    updater && typeof updater.enqueueForceUpdate === 'function'
  ) {
    updater.enqueueForceUpdate(publicInstance)
  }
  if (onUpdate) {
    onUpdate(publicInstance)
  }
  return undefined
}

export default function deepForceUpdate(
  instance,
  shouldUpdateClosestClassInstance,
  onUpdateClassInstance,
) {
  const root = instance._reactInternalFiber || instance._reactInternalInstance
  if (typeof root.tag !== 'number') {
    if (shouldUpdateClosestClassInstance || onUpdateClassInstance) {
      throw new Error('shouldUpdateClosestClassInstance and ' +
        'onUpdateClassInstance are only supported in React Fiber')
    }
    // Traverse stack-based React tree.
    return deepForceUpdateStack(instance)
  }

  let node = root
  const toUpdate = shouldUpdateClosestClassInstance ? [] : null
  while (true) {
    onEnterFiber(node, toUpdate, shouldUpdateClosestClassInstance)
    if (node.child) {
      node.child.return = node
      node = node.child
      continue
    }
    while (!node.sibling || node === root) {
      onLeaveFiber(node, toUpdate, onUpdateClassInstance)
      if (!node.return || node === root) {
        return undefined
      }
      node = node.return
    }
    onLeaveFiber(node, toUpdate, onUpdateClassInstance)
    node.sibling.return = node.return
    node = node.sibling
  }
}
